ALTER TABLE public.communication_logs
ADD COLUMN IF NOT EXISTS message_id text UNIQUE;