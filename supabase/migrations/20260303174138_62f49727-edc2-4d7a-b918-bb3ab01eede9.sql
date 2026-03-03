
-- Allow company admins to also read their own company from base table (needed for settings page with sensitive fields)
DROP POLICY IF EXISTS "Only super_admins can view companies directly" ON public.companies;

CREATE POLICY "Company admins and super_admins can view companies"
ON public.companies
FOR SELECT
USING (
  (id = get_my_company_id() AND has_role(auth.uid(), 'admin'::app_role))
  OR is_super_admin()
);
