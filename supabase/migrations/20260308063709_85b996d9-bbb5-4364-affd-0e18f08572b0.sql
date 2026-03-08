-- Add WeFact columns
ALTER TABLE companies ADD COLUMN IF NOT EXISTS wefact_api_key text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS wefact_debtor_code text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS wefact_id text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS wefact_id text;

-- Recreate companies_safe view with wefact masking
CREATE OR REPLACE VIEW public.companies_safe AS
SELECT
    id, name, max_users, created_at, smtp_port,
    eboekhouden_ledger_id, eboekhouden_template_id, eboekhouden_debtor_ledger_id,
    slug, address, city, postal_code, phone, kvk_number, btw_number, iban, logo_url,
    brand_color, industry, subcategory, enabled_features,
    accounting_provider, email_provider,
    outlook_email, outlook_client_id, outlook_tenant_id,
    smtp_email, smtp_host, custom_domain,
    rompslomp_company_id, rompslomp_company_name, rompslomp_tenant_id,
    moneybird_administration_id,
    pwa_name, pwa_icon_url,
    (eboekhouden_api_token IS NOT NULL AND eboekhouden_api_token <> '') AS has_eboekhouden_token,
    (wefact_api_key IS NOT NULL AND wefact_api_key <> '') AS has_wefact_key
FROM companies;