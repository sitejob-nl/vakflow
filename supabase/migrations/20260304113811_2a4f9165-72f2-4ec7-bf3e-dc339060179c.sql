
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS industry text NOT NULL DEFAULT 'technical';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS subcategory text NOT NULL DEFAULT 'installation';

DROP VIEW IF EXISTS public.companies_safe;
CREATE VIEW public.companies_safe AS
SELECT
  id, name, slug, address, city, postal_code, phone,
  kvk_number, btw_number, iban, logo_url, brand_color, max_users,
  created_at, enabled_features, accounting_provider,
  email_provider, outlook_email, outlook_client_id, outlook_tenant_id,
  smtp_email, smtp_host, smtp_port,
  rompslomp_company_id, rompslomp_company_name, rompslomp_tenant_id,
  moneybird_administration_id,
  eboekhouden_ledger_id, eboekhouden_template_id, eboekhouden_debtor_ledger_id,
  industry, subcategory
FROM public.companies;
