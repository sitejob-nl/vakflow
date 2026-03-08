-- Create trade-vehicle-photos storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('trade-vehicle-photos', 'trade-vehicle-photos', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for trade-vehicle-photos bucket (company isolation)
CREATE POLICY "Company members can upload trade vehicle photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'trade-vehicle-photos'
  AND (storage.foldername(name))[1] = (SELECT get_my_company_id()::text)
);

CREATE POLICY "Company members can view trade vehicle photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'trade-vehicle-photos'
  AND (storage.foldername(name))[1] = (SELECT get_my_company_id()::text)
);

CREATE POLICY "Admins can delete trade vehicle photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'trade-vehicle-photos'
  AND (storage.foldername(name))[1] = (SELECT get_my_company_id()::text)
);