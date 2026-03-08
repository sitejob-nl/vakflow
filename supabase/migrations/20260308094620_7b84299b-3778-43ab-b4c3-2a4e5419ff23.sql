
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS seasonal_months integer[] DEFAULT NULL;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS frequency text DEFAULT NULL;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS auto_invoice boolean DEFAULT false;

ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL;
