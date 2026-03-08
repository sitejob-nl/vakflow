
-- 1. exact_id op quotes
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS exact_id text;

-- 2. journal_code op exact_config
ALTER TABLE public.exact_config ADD COLUMN IF NOT EXISTS journal_code text DEFAULT '70';

-- 3. kvk_number en btw_number op customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS kvk_number text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS btw_number text;
