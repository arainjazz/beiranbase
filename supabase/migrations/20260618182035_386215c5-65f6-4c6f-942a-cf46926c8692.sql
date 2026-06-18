DROP POLICY IF EXISTS user_roles_owner_manage ON public.user_roles;
CREATE POLICY user_roles_owner_manage ON public.user_roles
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'owner'::app_role));