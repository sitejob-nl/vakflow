
-- Create public bucket for company logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true);

-- Allow authenticated users to view all logos (public bucket)
CREATE POLICY "Anyone can view company logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'company-logos');

-- Allow authenticated users to upload logos to their own company folder
CREATE POLICY "Company admins can upload logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-logos'
  AND (storage.foldername(name))[1] = get_my_company_id()::text
  AND has_role(auth.uid(), 'admin')
);

-- Allow authenticated users to update logos in their own company folder
CREATE POLICY "Company admins can update logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'company-logos'
  AND (storage.foldername(name))[1] = get_my_company_id()::text
  AND has_role(auth.uid(), 'admin')
);

-- Allow authenticated users to delete logos in their own company folder
CREATE POLICY "Company admins can delete logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'company-logos'
  AND (storage.foldername(name))[1] = get_my_company_id()::text
  AND has_role(auth.uid(), 'admin')
);
