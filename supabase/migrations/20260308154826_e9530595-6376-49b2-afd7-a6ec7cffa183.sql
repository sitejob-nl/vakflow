
-- Fix: drop the existing admin-only SELECT policies that were already created
-- and the ones that still need updating

-- meta_config: already has admin SELECT from previous migration's write policies
-- We need to check what SELECT policies exist and fix if needed
DROP POLICY IF EXISTS "Company admins can view meta_config" ON public.meta_config;
CREATE POLICY "Company admins can view meta_config"
  ON public.meta_config
  FOR SELECT
  TO authenticated
  USING (
    (company_id = (SELECT get_my_company_id()) AND has_role((SELECT auth.uid()), 'admin'::app_role, (SELECT get_my_company_id())))
    OR (SELECT is_super_admin())
  );
