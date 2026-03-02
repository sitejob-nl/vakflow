
-- Create assets/objects table
CREATE TABLE public.assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  address_id UUID REFERENCES public.addresses(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  asset_type TEXT,
  brand TEXT,
  model TEXT,
  serial_number TEXT,
  install_date DATE,
  last_maintenance_date DATE,
  next_maintenance_date DATE,
  status TEXT NOT NULL DEFAULT 'actief',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Company users can view assets"
  ON public.assets FOR SELECT
  USING (company_id = get_my_company_id() OR is_super_admin());

CREATE POLICY "Company users can insert assets"
  ON public.assets FOR INSERT
  WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "Company users can update assets"
  ON public.assets FOR UPDATE
  USING (company_id = get_my_company_id());

CREATE POLICY "Company users can delete assets"
  ON public.assets FOR DELETE
  USING (company_id = get_my_company_id());

-- Updated_at trigger
CREATE TRIGGER update_assets_updated_at
  BEFORE UPDATE ON public.assets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Maintenance log table for history
CREATE TABLE public.asset_maintenance_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  work_order_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL,
  maintenance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.asset_maintenance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view maintenance logs"
  ON public.asset_maintenance_logs FOR SELECT
  USING (company_id = get_my_company_id() OR is_super_admin());

CREATE POLICY "Company users can insert maintenance logs"
  ON public.asset_maintenance_logs FOR INSERT
  WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "Company users can update maintenance logs"
  ON public.asset_maintenance_logs FOR UPDATE
  USING (company_id = get_my_company_id());

CREATE POLICY "Company users can delete maintenance logs"
  ON public.asset_maintenance_logs FOR DELETE
  USING (company_id = get_my_company_id());
