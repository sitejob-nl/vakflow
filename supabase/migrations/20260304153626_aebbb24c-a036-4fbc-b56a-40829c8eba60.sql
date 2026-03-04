
-- Exact Online config table
CREATE TABLE public.exact_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid UNIQUE NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tenant_id uuid,
  webhook_secret text,
  division integer,
  company_name_exact text,
  region text DEFAULT 'nl',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exact_config ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Company admins can view exact_config"
  ON public.exact_config FOR SELECT TO authenticated
  USING ((company_id = (SELECT get_my_company_id())) OR (SELECT is_super_admin()));

CREATE POLICY "Company admins can insert exact_config"
  ON public.exact_config FOR INSERT TO authenticated
  WITH CHECK ((company_id = (SELECT get_my_company_id())) AND has_role((SELECT auth.uid()), 'admin'::app_role));

CREATE POLICY "Company admins can update exact_config"
  ON public.exact_config FOR UPDATE TO authenticated
  USING ((company_id = (SELECT get_my_company_id())) AND has_role((SELECT auth.uid()), 'admin'::app_role));

CREATE POLICY "Company admins can delete exact_config"
  ON public.exact_config FOR DELETE TO authenticated
  USING ((company_id = (SELECT get_my_company_id())) AND has_role((SELECT auth.uid()), 'admin'::app_role));

-- Service role needs insert for edge functions
CREATE POLICY "Service role can manage exact_config"
  ON public.exact_config FOR ALL
  USING (true) WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_exact_config_updated_at
  BEFORE UPDATE ON public.exact_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
