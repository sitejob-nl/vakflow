-- Service requests table
CREATE TABLE public.service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'aangevraagd',
  media text[] DEFAULT '{}',
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;

-- Portal users can view their own requests
CREATE POLICY "Portal users can view own service requests"
ON public.service_requests FOR SELECT TO authenticated
USING (customer_id = (SELECT get_portal_customer_id()));

-- Portal users can insert service requests
CREATE POLICY "Portal users can insert service requests"
ON public.service_requests FOR INSERT TO authenticated
WITH CHECK (
  customer_id = (SELECT get_portal_customer_id())
  AND status = 'aangevraagd'
);

-- Company users can view/update service requests
CREATE POLICY "Company users can view service requests"
ON public.service_requests FOR SELECT TO authenticated
USING (company_id = (SELECT get_my_company_id()) OR (SELECT is_super_admin()));

CREATE POLICY "Company users can update service requests"
ON public.service_requests FOR UPDATE TO authenticated
USING (company_id = (SELECT get_my_company_id()) OR (SELECT is_super_admin()));

-- Updated_at trigger
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.service_requests
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Storage bucket for portal uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('portal-uploads', 'portal-uploads', false);

-- Portal users can upload to portal-uploads bucket (scoped to company)
CREATE POLICY "Portal users can upload media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'portal-uploads'
  AND (SELECT get_portal_customer_id()) IS NOT NULL
);

-- Portal users can view their own uploads
CREATE POLICY "Portal users can view own uploads"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'portal-uploads'
  AND (SELECT get_portal_customer_id()) IS NOT NULL
);

-- Company users can view portal uploads for their company
CREATE POLICY "Company users can view portal uploads"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'portal-uploads'
  AND (position((SELECT get_my_company_id())::text IN name) = 1 OR (SELECT is_super_admin()))
);