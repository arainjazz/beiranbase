CREATE POLICY "user_roles_owner_manage" ON public.user_roles
  FOR ALL
  USING (private.has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'owner'::app_role));