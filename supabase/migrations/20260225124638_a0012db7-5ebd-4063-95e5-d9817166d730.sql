
-- Add company details fields to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kvk_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS btw_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_address text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_postal_code text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_city text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS iban text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS logo_url text;
