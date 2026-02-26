
-- Stap 1: Voeg webhook_secret kolom toe aan whatsapp_config
ALTER TABLE public.whatsapp_config ADD COLUMN IF NOT EXISTS webhook_secret text;

-- Stap 2: Verwijder de huidige "pending" rij zodat er schoon herregistreerd kan worden
DELETE FROM public.whatsapp_config WHERE access_token = 'pending' OR phone_number_id = 'pending';
