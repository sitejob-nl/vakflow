
-- Add Moneybird columns to companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS moneybird_api_token text,
  ADD COLUMN IF NOT EXISTS moneybird_administration_id text;

-- Add Moneybird contact ID to customers
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS moneybird_contact_id text;

-- Add Moneybird ID to invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS moneybird_id text;

-- Add Moneybird ID to quotes
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS moneybird_id text;
