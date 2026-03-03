
-- ============================================================
-- 1. Storage RLS policies: tenant-isolatie op whatsapp-media en work-order-photos
-- ============================================================

-- Drop bestaande storage policies voor deze buckets
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload work-order-photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view work-order-photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete work-order-photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload whatsapp-media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view whatsapp-media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete whatsapp-media" ON storage.objects;

-- Tenant-scoped SELECT: eigen company_id prefix
CREATE POLICY "Tenant users can view own files in work-order-photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'work-order-photos'
  AND (storage.foldername(name))[1] = get_my_company_id()::text
);

CREATE POLICY "Tenant users can view own files in whatsapp-media"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'whatsapp-media'
  AND (storage.foldername(name))[1] = get_my_company_id()::text
);

-- Tenant-scoped INSERT: alleen eigen company_id prefix
CREATE POLICY "Tenant users can upload to own folder in work-order-photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'work-order-photos'
  AND (storage.foldername(name))[1] = get_my_company_id()::text
);

CREATE POLICY "Tenant users can upload to own folder in whatsapp-media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'whatsapp-media'
  AND (storage.foldername(name))[1] = get_my_company_id()::text
);

-- Tenant-scoped DELETE
CREATE POLICY "Tenant users can delete own files in work-order-photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'work-order-photos'
  AND (storage.foldername(name))[1] = get_my_company_id()::text
);

CREATE POLICY "Tenant users can delete own files in whatsapp-media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'whatsapp-media'
  AND (storage.foldername(name))[1] = get_my_company_id()::text
);

-- Service role bypass: edge functions (whatsapp-webhook) gebruiken service_role die RLS bypassed
-- Dus geen extra policy nodig voor service_role uploads.

-- Super admin fallback: kan alle storage objecten zien
CREATE POLICY "Super admins can view all storage objects"
ON storage.objects FOR SELECT
TO authenticated
USING (is_super_admin());

-- ============================================================
-- 2. Usage events tabel
-- ============================================================

CREATE TABLE public.usage_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_usage_events_company_type_date ON public.usage_events (company_id, event_type, created_at);

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

-- Alleen super_admins kunnen lezen
CREATE POLICY "Super admins can view usage_events"
ON public.usage_events FOR SELECT
TO authenticated
USING (is_super_admin());

-- Geen INSERT/UPDATE/DELETE via client — alleen via service_role

-- ============================================================
-- 3. get_usage_summary RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_usage_summary(
  p_company_id uuid DEFAULT NULL,
  p_start timestamptz DEFAULT (date_trunc('month', now())),
  p_end timestamptz DEFAULT now()
)
RETURNS TABLE(company_id uuid, event_type text, event_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ue.company_id,
    ue.event_type,
    count(*) AS event_count
  FROM public.usage_events ue
  WHERE ue.created_at >= p_start
    AND ue.created_at < p_end
    AND (p_company_id IS NULL OR ue.company_id = p_company_id)
  GROUP BY ue.company_id, ue.event_type
  ORDER BY ue.company_id, ue.event_type
$$;
