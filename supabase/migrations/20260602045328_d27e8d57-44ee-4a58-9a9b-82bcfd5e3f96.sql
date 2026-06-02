-- Restrict role_requests inserts: users may only request 'admin' or 'subscriber', never 'owner'
DROP POLICY IF EXISTS role_req_self_insert ON public.role_requests;
CREATE POLICY role_req_self_insert ON public.role_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND requested_role IN ('admin'::app_role, 'subscriber'::app_role)
  );

-- Allow owners/admins to read profiles so the admin approval UI can show
-- applicants' email/display name (currently the admin page queries profiles
-- by id and would otherwise return empty rows under RLS).
CREATE POLICY profiles_admin_read ON public.profiles
  FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'owner'::app_role)
    OR private.has_role(auth.uid(), 'admin'::app_role)
  );
