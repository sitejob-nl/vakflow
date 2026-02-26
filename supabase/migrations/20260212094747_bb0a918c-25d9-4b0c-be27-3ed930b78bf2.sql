
-- Add e-Boekhouden settings to profiles
ALTER TABLE public.profiles ADD COLUMN eboekhouden_template_id integer;
ALTER TABLE public.profiles ADD COLUMN eboekhouden_ledger_id integer;

-- Add e-Boekhouden relation mapping to customers
ALTER TABLE public.customers ADD COLUMN eboekhouden_relation_id integer;
