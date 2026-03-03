-- Add user_access_token column for token refresh
ALTER TABLE public.meta_config ADD COLUMN IF NOT EXISTS user_access_token text;
-- Add page_name column to show which page is connected
ALTER TABLE public.meta_config ADD COLUMN IF NOT EXISTS page_name text;