
-- ===== Enums =====
create type public.app_role as enum ('owner', 'admin', 'subscriber');
create type public.request_status as enum ('pending', 'approved', 'rejected');
create type public.post_page as enum ('story', 'community');

-- ===== Profiles =====
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles_self_read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles_self_update" on public.profiles for update to authenticated using (id = auth.uid());
create policy "profiles_self_insert" on public.profiles for insert to authenticated with check (id = auth.uid());

-- ===== User roles =====
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "user_roles_self_read" on public.user_roles for select to authenticated using (user_id = auth.uid());

-- Security definer role check
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

-- Owner can read all roles, admin can read all roles too
create policy "user_roles_admin_read" on public.user_roles for select to authenticated
  using (public.has_role(auth.uid(), 'owner') or public.has_role(auth.uid(), 'admin'));

-- ===== Role requests =====
create table public.role_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_role public.app_role not null check (requested_role in ('admin','subscriber')),
  status public.request_status not null default 'pending',
  note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id)
);
grant select, insert on public.role_requests to authenticated;
grant update on public.role_requests to authenticated;
grant all on public.role_requests to service_role;
alter table public.role_requests enable row level security;
create policy "role_req_self_read" on public.role_requests for select to authenticated using (user_id = auth.uid());
create policy "role_req_self_insert" on public.role_requests for insert to authenticated with check (user_id = auth.uid());
create policy "role_req_admin_read" on public.role_requests for select to authenticated
  using (public.has_role(auth.uid(), 'owner') or public.has_role(auth.uid(), 'admin'));
create policy "role_req_admin_update" on public.role_requests for update to authenticated
  using (public.has_role(auth.uid(), 'owner') or public.has_role(auth.uid(), 'admin'));

-- ===== Posts (story + community) =====
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  page public.post_page not null,
  title text not null,
  subtitle text,
  body text not null,
  image_url text,
  author_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.posts to anon, authenticated;
grant insert, update, delete on public.posts to authenticated;
grant all on public.posts to service_role;
alter table public.posts enable row level security;
create policy "posts_public_read" on public.posts for select to anon, authenticated using (true);
create policy "posts_admin_write" on public.posts for insert to authenticated
  with check (public.has_role(auth.uid(), 'owner') or public.has_role(auth.uid(), 'admin'));
create policy "posts_admin_update" on public.posts for update to authenticated
  using (public.has_role(auth.uid(), 'owner') or public.has_role(auth.uid(), 'admin'));
create policy "posts_admin_delete" on public.posts for delete to authenticated
  using (public.has_role(auth.uid(), 'owner') or public.has_role(auth.uid(), 'admin'));

-- ===== Comments =====
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
grant select on public.comments to anon, authenticated;
grant insert on public.comments to authenticated;
grant delete on public.comments to authenticated;
grant all on public.comments to service_role;
alter table public.comments enable row level security;
create policy "comments_public_read" on public.comments for select to anon, authenticated using (true);
create policy "comments_subscriber_insert" on public.comments for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      public.has_role(auth.uid(), 'subscriber')
      or public.has_role(auth.uid(), 'admin')
      or public.has_role(auth.uid(), 'owner')
    )
  );
create policy "comments_owner_or_admin_delete" on public.comments for delete to authenticated
  using (
    user_id = auth.uid()
    or public.has_role(auth.uid(), 'owner')
    or public.has_role(auth.uid(), 'admin')
  );

-- ===== Course registrations =====
create table public.course_registrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_name text not null,
  applicant_name text not null,
  phone text,
  note text,
  status public.request_status not null default 'pending',
  created_at timestamptz not null default now()
);
grant select, insert on public.course_registrations to authenticated;
grant update on public.course_registrations to authenticated;
grant all on public.course_registrations to service_role;
alter table public.course_registrations enable row level security;
create policy "course_reg_self_read" on public.course_registrations for select to authenticated
  using (user_id = auth.uid());
create policy "course_reg_subscriber_insert" on public.course_registrations for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      public.has_role(auth.uid(), 'subscriber')
      or public.has_role(auth.uid(), 'admin')
      or public.has_role(auth.uid(), 'owner')
    )
  );
create policy "course_reg_admin_read" on public.course_registrations for select to authenticated
  using (public.has_role(auth.uid(), 'owner') or public.has_role(auth.uid(), 'admin'));
create policy "course_reg_admin_update" on public.course_registrations for update to authenticated
  using (public.has_role(auth.uid(), 'owner') or public.has_role(auth.uid(), 'admin'));

-- ===== Auto-create profile + owner role on signup =====
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));

  -- Auto-grant owner role to the hardcoded owner email
  if lower(new.email) = 'arainjazz@gmail.com' then
    insert into public.user_roles (user_id, role) values (new.id, 'owner')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===== Seed: copy existing static posts into DB =====
insert into public.posts (page, title, subtitle, body, image_url) values
('story','惊蛰前夜，第一只青蛙回来了','立春 · 2026',
'去年我们在西边低洼处恢复了一片小湿地，今年开春第一声蛙鸣比预期早了三天。林老师说，这是水系修复成功的最直接信号——比任何检测仪器都更诚实。',
'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200'),
('story','与稻共生：鸭子上田的第一天','谷雨 · 2026',
'四十只小鸭子在清晨被放进刚插秧的稻田。它们既是除草工，也是松土的小工程师。我们用稻鸭共作替代除草剂，已经第七个年头了。',
'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=1200'),
('story','山里的一户人家，决定加入我们','秋分 · 2025',
'这一季最大的收获，不是粮食，而是邻村的陈伯一家决定一起做生态种植。他们的两亩茶园从今年秋天起，停止使用化学肥料。',
null),
('community','阿婆的织布机，又响起来了','黎族 · 织锦',
'隔壁村的王阿婆，是村里仅剩的还会织黎锦的老人。今年我们邀请她每周来基地两天，把这门手艺教给愿意学的年轻人。第一期来了七个学员。',
'https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?w=1200'),
('community','换工：用半天劳力，换一季的种子','耕作 · 互助',
'村里恢复了"换工"的传统。农忙时大家轮流到彼此田里干活，不计报酬。我们用这种方式重建邻里关系，也保留了多样化的本地种子。',
'https://images.unsplash.com/photo-1500595046743-cd271d694d30?w=1200'),
('community','三月三，山兰酒和长桌宴','节庆 · 三月三',
'今年的三月三，我们和邻村一起办了长桌宴。山兰酒是用基地自己种的山兰稻酿的，孩子们在田边追逐，老人在树下唱古调。',
null);
