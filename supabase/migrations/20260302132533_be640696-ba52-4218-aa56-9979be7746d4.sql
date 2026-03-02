
-- Rompslomp kolommen op companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS rompslomp_tenant_id text,
  ADD COLUMN IF NOT EXISTS rompslomp_webhook_secret text,
  ADD COLUMN IF NOT EXISTS rompslomp_company_id text,
  ADD COLUMN IF NOT EXISTS rompslomp_company_name text;

-- Rompslomp kolom op customers
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS rompslomp_contact_id text;

-- Rompslomp kolom op invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS rompslomp_id text;
