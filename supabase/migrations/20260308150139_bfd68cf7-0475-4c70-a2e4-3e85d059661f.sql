-- Lead statuses (kanban columns)
CREATE TABLE public.lead_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3b82f6',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view lead_statuses" ON public.lead_statuses
  FOR SELECT TO authenticated
  USING (company_id = (SELECT get_my_company_id()) OR (SELECT is_super_admin()));

CREATE POLICY "Company admins can insert lead_statuses" ON public.lead_statuses
  FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT get_my_company_id()) AND has_role((SELECT auth.uid()), 'admin'::app_role));

CREATE POLICY "Company admins can update lead_statuses" ON public.lead_statuses
  FOR UPDATE TO authenticated
  USING (company_id = (SELECT get_my_company_id()) AND has_role((SELECT auth.uid()), 'admin'::app_role));

CREATE POLICY "Company admins can delete lead_statuses" ON public.lead_statuses
  FOR DELETE TO authenticated
  USING (company_id = (SELECT get_my_company_id()) AND has_role((SELECT auth.uid()), 'admin'::app_role));

-- Lead form fields (custom fields config)
CREATE TABLE public.lead_form_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  field_label text NOT NULL,
  field_type text NOT NULL DEFAULT 'text',
  is_required boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  options jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_form_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view lead_form_fields" ON public.lead_form_fields
  FOR SELECT TO authenticated
  USING (company_id = (SELECT get_my_company_id()) OR (SELECT is_super_admin()));

CREATE POLICY "Company admins can insert lead_form_fields" ON public.lead_form_fields
  FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT get_my_company_id()) AND has_role((SELECT auth.uid()), 'admin'::app_role));

CREATE POLICY "Company admins can update lead_form_fields" ON public.lead_form_fields
  FOR UPDATE TO authenticated
  USING (company_id = (SELECT get_my_company_id()) AND has_role((SELECT auth.uid()), 'admin'::app_role));

CREATE POLICY "Company admins can delete lead_form_fields" ON public.lead_form_fields
  FOR DELETE TO authenticated
  USING (company_id = (SELECT get_my_company_id()) AND has_role((SELECT auth.uid()), 'admin'::app_role));

-- Leads
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  status_id uuid NOT NULL REFERENCES public.lead_statuses(id) ON DELETE RESTRICT,
  name text NOT NULL,
  email text,
  phone text,
  company_name text,
  source text,
  value numeric DEFAULT 0,
  notes text,
  custom_fields jsonb DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view leads" ON public.leads
  FOR SELECT TO authenticated
  USING (company_id = (SELECT get_my_company_id()) OR (SELECT is_super_admin()));

CREATE POLICY "Company users can insert leads" ON public.leads
  FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT get_my_company_id()));

CREATE POLICY "Company users can update leads" ON public.leads
  FOR UPDATE TO authenticated
  USING (company_id = (SELECT get_my_company_id()));

CREATE POLICY "Company users can delete leads" ON public.leads
  FOR DELETE TO authenticated
  USING (company_id = (SELECT get_my_company_id()));

-- Trigger for updated_at
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();