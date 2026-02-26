-- Make storage buckets private to prevent unauthenticated access
UPDATE storage.buckets SET public = false WHERE id IN ('work-order-photos', 'whatsapp-media');

-- Update RLS policies for authenticated access only
DROP POLICY IF EXISTS "Whatsapp media is publicly readable" ON storage.objects;

CREATE POLICY "Authenticated users can view work-order-photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'work-order-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view whatsapp-media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'whatsapp-media' AND auth.uid() IS NOT NULL);