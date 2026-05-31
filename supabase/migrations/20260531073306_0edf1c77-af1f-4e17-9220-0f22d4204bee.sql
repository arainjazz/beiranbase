
create schema if not exists private;

create or replace function private.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

revoke execute on function private.has_role(uuid, public.app_role) from public, anon, authenticated;
grant execute on function private.has_role(uuid, public.app_role) to authenticated;

-- Recreate policies using private.has_role
drop policy if exists "user_roles_admin_read" on public.user_roles;
create policy "user_roles_admin_read" on public.user_roles for select to authenticated
  using (private.has_role(auth.uid(), 'owner') or private.has_role(auth.uid(), 'admin'));

drop policy if exists "role_req_admin_read" on public.role_requests;
create policy "role_req_admin_read" on public.role_requests for select to authenticated
  using (private.has_role(auth.uid(), 'owner') or private.has_role(auth.uid(), 'admin'));

drop policy if exists "role_req_admin_update" on public.role_requests;
create policy "role_req_admin_update" on public.role_requests for update to authenticated
  using (private.has_role(auth.uid(), 'owner') or private.has_role(auth.uid(), 'admin'));

drop policy if exists "posts_admin_write" on public.posts;
create policy "posts_admin_write" on public.posts for insert to authenticated
  with check (private.has_role(auth.uid(), 'owner') or private.has_role(auth.uid(), 'admin'));

drop policy if exists "posts_admin_update" on public.posts;
create policy "posts_admin_update" on public.posts for update to authenticated
  using (private.has_role(auth.uid(), 'owner') or private.has_role(auth.uid(), 'admin'));

drop policy if exists "posts_admin_delete" on public.posts;
create policy "posts_admin_delete" on public.posts for delete to authenticated
  using (private.has_role(auth.uid(), 'owner') or private.has_role(auth.uid(), 'admin'));

drop policy if exists "comments_subscriber_insert" on public.comments;
create policy "comments_subscriber_insert" on public.comments for insert to authenticated
  with check (
    user_id = auth.uid() and (
      private.has_role(auth.uid(), 'subscriber')
      or private.has_role(auth.uid(), 'admin')
      or private.has_role(auth.uid(), 'owner')
    )
  );

drop policy if exists "comments_owner_or_admin_delete" on public.comments;
create policy "comments_owner_or_admin_delete" on public.comments for delete to authenticated
  using (
    user_id = auth.uid()
    or private.has_role(auth.uid(), 'owner')
    or private.has_role(auth.uid(), 'admin')
  );

drop policy if exists "course_reg_subscriber_insert" on public.course_registrations;
create policy "course_reg_subscriber_insert" on public.course_registrations for insert to authenticated
  with check (
    user_id = auth.uid() and (
      private.has_role(auth.uid(), 'subscriber')
      or private.has_role(auth.uid(), 'admin')
      or private.has_role(auth.uid(), 'owner')
    )
  );

drop policy if exists "course_reg_admin_read" on public.course_registrations;
create policy "course_reg_admin_read" on public.course_registrations for select to authenticated
  using (private.has_role(auth.uid(), 'owner') or private.has_role(auth.uid(), 'admin'));

drop policy if exists "course_reg_admin_update" on public.course_registrations;
create policy "course_reg_admin_update" on public.course_registrations for update to authenticated
  using (private.has_role(auth.uid(), 'owner') or private.has_role(auth.uid(), 'admin'));

-- Drop the old public.has_role (no longer referenced)
drop function if exists public.has_role(uuid, public.app_role);
