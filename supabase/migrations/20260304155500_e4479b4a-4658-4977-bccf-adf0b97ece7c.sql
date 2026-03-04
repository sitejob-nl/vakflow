ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS exact_account_id text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS exact_id text;