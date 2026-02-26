-- Create storage bucket for WhatsApp media
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-media', 'whatsapp-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow service role (edge functions) to upload
CREATE POLICY "Service role can upload whatsapp media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'whatsapp-media');

-- Public read access
CREATE POLICY "Whatsapp media is publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'whatsapp-media');
