
-- Create a safe view that hides sensitive columns from the companies table
CREATE VIEW public.companies_safe
WITH (security_invoker = on) AS
SELECT
  id,
  name,
  slug,
  address,
  city,
  postal_code,
  phone,
  kvk_number,
  btw_number,
  iban,
  logo_url,
  brand_color,
  max_users,
  created_at,
  enabled_features,
  accounting_provider,
  email_provider,
  -- Outlook non-sensitive fields
  outlook_email,
  outlook_client_id,
  outlook_tenant_id,
  -- SMTP non-sensitive fields
  smtp_email,
  smtp_host,
  smtp_port,
  -- Rompslomp non-sensitive fields
  rompslomp_company_id,
  rompslomp_company_name,
  rompslomp_tenant_id,
  -- Moneybird non-sensitive field
  moneybird_administration_id,
  -- e-Boekhouden non-sensitive fields
  eboekhouden_ledger_id,
  eboekhouden_template_id,
  eboekhouden_debtor_ledger_id
FROM public.companies;
-- Excluded: smtp_password, outlook_refresh_token, rompslomp_api_token, rompslomp_webhook_secret,
--           moneybird_api_token, eboekhouden_api_token

-- Now restrict direct SELECT on the base table to only super_admins and service role
-- First drop the existing permissive SELECT policy
DROP POLICY IF EXISTS "Users can view own company" ON public.companies;

-- Recreate: only super_admins can SELECT the base table directly (needed for edge functions via service role)
CREATE POLICY "Only super_admins can view companies directly"
ON public.companies
FOR SELECT
USING (is_super_admin());

-- Service role policy already exists ("Service role full access companies") so edge functions still work
