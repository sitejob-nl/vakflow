
-- Add e-Boekhouden API token to profiles (user manages it via Settings UI)
ALTER TABLE public.profiles ADD COLUMN eboekhouden_api_token text;
