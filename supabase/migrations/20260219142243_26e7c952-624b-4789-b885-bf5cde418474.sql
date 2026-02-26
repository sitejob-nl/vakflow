
-- WhatsApp config table (credentials opslag, alleen service_role toegang)
CREATE TABLE public.whatsapp_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number_id text NOT NULL,
  access_token text NOT NULL,
  display_phone text,
  waba_id text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;
-- Geen RLS policies = alleen bereikbaar via service_role key

-- WhatsApp messages table
CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wamid text UNIQUE,
  direction text NOT NULL,
  from_number text,
  to_number text,
  content text,
  type text DEFAULT 'text',
  status text DEFAULT 'sent',
  sent_by uuid,
  customer_id uuid,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for whatsapp_messages
CREATE POLICY "Authenticated users can read messages"
  ON public.whatsapp_messages FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert messages"
  ON public.whatsapp_messages FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update messages"
  ON public.whatsapp_messages FOR UPDATE
  USING (auth.uid() IS NOT NULL);
