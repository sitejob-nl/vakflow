
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS accounting_provider text,
  ADD COLUMN IF NOT EXISTS email_provider text DEFAULT 'smtp',
  ADD COLUMN IF NOT EXISTS outlook_tenant_id text,
  ADD COLUMN IF NOT EXISTS outlook_client_id text,
  ADD COLUMN IF NOT EXISTS outlook_refresh_token text,
  ADD COLUMN IF NOT EXISTS outlook_email text;
