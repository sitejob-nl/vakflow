
-- Create storage bucket for work order photos
INSERT INTO storage.buckets (id, name, public) VALUES ('work-order-photos', 'work-order-photos', true);

-- Allow authenticated users to upload photos
CREATE POLICY "Authenticated users can upload work order photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'work-order-photos' AND auth.uid() IS NOT NULL);

-- Allow authenticated users to view photos
CREATE POLICY "Authenticated users can view work order photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'work-order-photos' AND auth.uid() IS NOT NULL);

-- Allow authenticated users to delete their photos
CREATE POLICY "Authenticated users can delete work order photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'work-order-photos' AND auth.uid() IS NOT NULL);
