-- Fix: restrict whatsapp_config SELECT to admins only
DROP POLICY IF EXISTS "Company users can view whatsapp_config" ON public.whatsapp_config;
CREATE POLICY "Company admins can view whatsapp_config" ON public.whatsapp_config
  FOR SELECT TO authenticated
  USING (
    (company_id = (SELECT public.get_my_company_id()) AND public.has_role((SELECT auth.uid()), 'admin'::app_role))
    OR (SELECT public.is_super_admin())
  );