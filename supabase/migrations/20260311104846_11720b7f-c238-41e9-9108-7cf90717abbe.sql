
-- Create exact_online_connections table
CREATE TABLE public.exact_online_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  division_id text NOT NULL,
  tenant_id text,
  webhook_secret text,
  exact_division integer,
  company_name text,
  region text DEFAULT 'nl',
  is_active boolean DEFAULT true,
  connected_at timestamptz,
  webhooks_enabled boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(division_id),
  UNIQUE(company_id)
);

ALTER TABLE public.exact_online_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exact_online_connections_select" ON public.exact_online_connections
  FOR SELECT TO authenticated USING (company_id = public.get_my_company_id());
CREATE POLICY "exact_online_connections_insert" ON public.exact_online_connections
  FOR INSERT TO authenticated WITH CHECK (company_id = public.get_my_company_id());
CREATE POLICY "exact_online_connections_update" ON public.exact_online_connections
  FOR UPDATE TO authenticated USING (company_id = public.get_my_company_id());
CREATE POLICY "exact_online_connections_delete" ON public.exact_online_connections
  FOR DELETE TO authenticated USING (company_id = public.get_my_company_id());

CREATE INDEX idx_exact_online_connections_company ON public.exact_online_connections(company_id);
CREATE INDEX idx_exact_online_connections_tenant ON public.exact_online_connections(tenant_id);

-- Migrate existing exact_config data
INSERT INTO public.exact_online_connections (company_id, division_id, tenant_id, webhook_secret, exact_division, company_name, region, is_active, connected_at)
SELECT 
  ec.company_id,
  ec.tenant_id,
  ec.tenant_id,
  ec.webhook_secret,
  ec.division,
  ec.company_name_exact,
  COALESCE(ec.region, 'nl'),
  (ec.status = 'connected'),
  ec.updated_at::timestamptz
FROM public.exact_config ec
WHERE ec.tenant_id IS NOT NULL
ON CONFLICT (company_id) DO NOTHING;
