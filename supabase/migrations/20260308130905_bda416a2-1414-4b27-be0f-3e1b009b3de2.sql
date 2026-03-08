DROP POLICY "Company users can update templates" ON public.quote_templates;
CREATE POLICY "Company users can update templates" ON public.quote_templates
  FOR UPDATE TO authenticated
  USING (company_id = (SELECT get_my_company_id()) OR (SELECT is_super_admin()));

DROP POLICY "Company users can delete templates" ON public.quote_templates;
CREATE POLICY "Company users can delete templates" ON public.quote_templates
  FOR DELETE TO authenticated
  USING (company_id = (SELECT get_my_company_id()) OR (SELECT is_super_admin()));