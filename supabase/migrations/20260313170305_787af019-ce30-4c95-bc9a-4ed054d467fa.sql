
ALTER TABLE public.meta_marketing_config
  ADD COLUMN IF NOT EXISTS user_access_token text,
  ADD COLUMN IF NOT EXISTS page_access_token text,
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS business_id text,
  ADD COLUMN IF NOT EXISTS connect_url text;
