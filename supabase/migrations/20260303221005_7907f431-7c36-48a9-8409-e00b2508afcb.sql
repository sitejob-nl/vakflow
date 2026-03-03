
-- Fix: super_admins kunnen customers updaten van alle bedrijven
DROP POLICY "Company users can update customers" ON public.customers;
CREATE POLICY "Company users can update customers" ON public.customers
  FOR UPDATE TO authenticated
  USING ((company_id = (SELECT get_my_company_id())) OR (SELECT is_super_admin()));

-- Fix: super_admins kunnen customers inserten voor alle bedrijven
DROP POLICY "Company users can insert customers" ON public.customers;
CREATE POLICY "Company users can insert customers" ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK ((company_id = (SELECT get_my_company_id())) OR (SELECT is_super_admin()));

-- Fix: super_admins kunnen customers deleten van alle bedrijven
DROP POLICY "Company users can delete customers" ON public.customers;
CREATE POLICY "Company users can delete customers" ON public.customers
  FOR DELETE TO authenticated
  USING ((company_id = (SELECT get_my_company_id())) OR (SELECT is_super_admin()));

-- Zelfde fix voor addresses tabel
DROP POLICY "Company users can update addresses" ON public.addresses;
CREATE POLICY "Company users can update addresses" ON public.addresses
  FOR UPDATE TO authenticated
  USING ((company_id = (SELECT get_my_company_id())) OR (SELECT is_super_admin()));

DROP POLICY "Company users can insert addresses" ON public.addresses;
CREATE POLICY "Company users can insert addresses" ON public.addresses
  FOR INSERT TO authenticated
  WITH CHECK ((company_id = (SELECT get_my_company_id())) OR (SELECT is_super_admin()));

DROP POLICY "Company users can delete addresses" ON public.addresses;
CREATE POLICY "Company users can delete addresses" ON public.addresses
  FOR DELETE TO authenticated
  USING ((company_id = (SELECT get_my_company_id())) OR (SELECT is_super_admin()));
