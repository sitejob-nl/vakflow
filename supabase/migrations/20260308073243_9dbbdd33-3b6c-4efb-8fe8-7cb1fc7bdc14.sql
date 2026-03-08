
-- Add moneybird_product_id to materials
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS moneybird_product_id text;

-- Add moneybird_subscription_id to contracts
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS moneybird_subscription_id text;
