DROP POLICY IF EXISTS "Only super admins can view companies directly" ON companies;

CREATE POLICY "Company members can view own company"
  ON companies FOR SELECT TO authenticated
  USING (
    id = (SELECT get_my_company_id())
    OR (SELECT is_super_admin())
  );