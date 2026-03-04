ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS imap_host text DEFAULT NULL;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS imap_port integer DEFAULT NULL;