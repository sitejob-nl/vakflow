CREATE POLICY "Super admins can update companies"
ON public.companies
FOR UPDATE
USING (is_super_admin())
WITH CHECK (is_super_admin());