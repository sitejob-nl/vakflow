
-- Contracts table
CREATE TABLE public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) NOT NULL,
  customer_id uuid REFERENCES public.customers(id) NOT NULL,
  service_id uuid REFERENCES public.services(id),
  address_id uuid REFERENCES public.addresses(id),
  asset_id uuid REFERENCES public.assets(id),
  assigned_to uuid REFERENCES public.profiles(id),
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'actief',
  interval_months integer NOT NULL DEFAULT 12,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  last_generated_at date,
  next_due_date date NOT NULL DEFAULT CURRENT_DATE,
  price numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Updated_at trigger
CREATE TRIGGER update_contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- RLS policies (same pattern as other tables)
CREATE POLICY "Company users can view contracts"
  ON public.contracts FOR SELECT TO authenticated
  USING ((company_id = (SELECT get_my_company_id())) OR (SELECT is_super_admin()));

CREATE POLICY "Company admins can insert contracts"
  ON public.contracts FOR INSERT TO authenticated
  WITH CHECK ((company_id = (SELECT get_my_company_id())) AND has_role((SELECT auth.uid()), 'admin'));

CREATE POLICY "Company admins can update contracts"
  ON public.contracts FOR UPDATE TO authenticated
  USING ((company_id = (SELECT get_my_company_id())) AND has_role((SELECT auth.uid()), 'admin'));

CREATE POLICY "Company admins can delete contracts"
  ON public.contracts FOR DELETE TO authenticated
  USING ((company_id = (SELECT get_my_company_id())) AND has_role((SELECT auth.uid()), 'admin'));

-- Add 'contracts' to default enabled_features
ALTER TABLE public.companies
  ALTER COLUMN enabled_features
  SET DEFAULT ARRAY['dashboard','planning','customers','workorders','invoices','quotes','reports','email','whatsapp','communication','reminders','assets','marketing','contracts'];
