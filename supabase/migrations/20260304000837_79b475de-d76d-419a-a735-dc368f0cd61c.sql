-- Restrict companies SELECT to super_admin only (credentials protection)
DROP POLICY "Company admins and super_admins can view companies" ON companies;
CREATE POLICY "Only super admins can view companies directly"
  ON companies FOR SELECT TO authenticated
  USING ((SELECT is_super_admin()));