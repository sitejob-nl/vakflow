
-- Meta Marketing config table for SiteJob Connect integration
CREATE TABLE public.meta_marketing_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE UNIQUE,
  tenant_id text,
  webhook_secret text,
  ad_account_id text,
  ad_account_name text,
  page_id text,
  page_name text,
  instagram_id text,
  instagram_username text,
  granted_scopes text,
  is_connected boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.meta_marketing_config ENABLE ROW LEVEL SECURITY;

-- Admins can read their company's config
CREATE POLICY "admin_select_meta_marketing_config" ON public.meta_marketing_config
  FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id() AND public.has_role(auth.uid(), 'admin'::app_role));

-- Admins can insert/update their company's config
CREATE POLICY "admin_insert_meta_marketing_config" ON public.meta_marketing_config
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id() AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin_update_meta_marketing_config" ON public.meta_marketing_config
  FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id() AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (company_id = public.get_my_company_id() AND public.has_role(auth.uid(), 'admin'::app_role));

-- Index
CREATE INDEX idx_meta_marketing_config_company ON public.meta_marketing_config(company_id);
CREATE INDEX idx_meta_marketing_config_tenant ON public.meta_marketing_config(tenant_id);
