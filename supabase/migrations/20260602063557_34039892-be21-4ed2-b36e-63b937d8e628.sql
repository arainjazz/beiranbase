
-- 1. Extend post_page enum
ALTER TYPE public.post_page ADD VALUE IF NOT EXISTS 'species';
ALTER TYPE public.post_page ADD VALUE IF NOT EXISTS 'courses';
ALTER TYPE public.post_page ADD VALUE IF NOT EXISTS 'ecofarming';
ALTER TYPE public.post_page ADD VALUE IF NOT EXISTS 'gifts';

-- 2. page_intros table
CREATE TABLE public.page_intros (
  page public.post_page PRIMARY KEY,
  intro text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.page_intros TO anon;
GRANT SELECT, INSERT, UPDATE ON public.page_intros TO authenticated;
GRANT ALL ON public.page_intros TO service_role;
ALTER TABLE public.page_intros ENABLE ROW LEVEL SECURITY;

CREATE POLICY page_intros_public_read ON public.page_intros
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY page_intros_admin_write ON public.page_intros
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(),'owner') OR private.has_role(auth.uid(),'admin'));
CREATE POLICY page_intros_admin_update ON public.page_intros
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(),'owner') OR private.has_role(auth.uid(),'admin'));

-- 3. feedback_messages table
CREATE TABLE public.feedback_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  name text,
  email text,
  body text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.feedback_messages TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.feedback_messages TO authenticated;
GRANT ALL ON public.feedback_messages TO service_role;
ALTER TABLE public.feedback_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY feedback_anyone_insert ON public.feedback_messages
  FOR INSERT TO anon, authenticated
  WITH CHECK (length(body) > 0 AND length(body) <= 2000);
CREATE POLICY feedback_admin_read ON public.feedback_messages
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'owner') OR private.has_role(auth.uid(),'admin'));
CREATE POLICY feedback_admin_update ON public.feedback_messages
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(),'owner') OR private.has_role(auth.uid(),'admin'));
CREATE POLICY feedback_admin_delete ON public.feedback_messages
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(),'owner') OR private.has_role(auth.uid(),'admin'));

CREATE INDEX feedback_unread_idx ON public.feedback_messages (is_read, created_at DESC);

-- 4. add sort column to posts so admin can later reorder; default to created_at
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
