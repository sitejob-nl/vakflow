
-- 1. Vehicles table
CREATE TABLE public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  license_plate text NOT NULL,
  vin text,
  brand text,
  model text,
  build_year integer,
  fuel_type text,
  color text,
  apk_expiry_date date,
  registration_date date,
  vehicle_mass integer,
  mileage_current integer DEFAULT 0,
  mileage_updated_at timestamp with time zone,
  notes text,
  status text NOT NULL DEFAULT 'actief',
  rdw_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (company_id, license_plate)
);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view vehicles" ON public.vehicles FOR SELECT USING (company_id = (SELECT get_my_company_id()) OR (SELECT is_super_admin()));
CREATE POLICY "Company users can insert vehicles" ON public.vehicles FOR INSERT WITH CHECK (company_id = (SELECT get_my_company_id()) OR (SELECT is_super_admin()));
CREATE POLICY "Company users can update vehicles" ON public.vehicles FOR UPDATE USING (company_id = (SELECT get_my_company_id()) OR (SELECT is_super_admin()));
CREATE POLICY "Company users can delete vehicles" ON public.vehicles FOR DELETE USING (company_id = (SELECT get_my_company_id()) OR (SELECT is_super_admin()));

CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. Vehicle mileage logs
CREATE TABLE public.vehicle_mileage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE CASCADE NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  mileage integer NOT NULL,
  recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL,
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.vehicle_mileage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view mileage logs" ON public.vehicle_mileage_logs FOR SELECT USING (company_id = (SELECT get_my_company_id()) OR (SELECT is_super_admin()));
CREATE POLICY "Company users can insert mileage logs" ON public.vehicle_mileage_logs FOR INSERT WITH CHECK (company_id = (SELECT get_my_company_id()) OR (SELECT is_super_admin()));
CREATE POLICY "Company users can update mileage logs" ON public.vehicle_mileage_logs FOR UPDATE USING (company_id = (SELECT get_my_company_id()) OR (SELECT is_super_admin()));
CREATE POLICY "Company users can delete mileage logs" ON public.vehicle_mileage_logs FOR DELETE USING (company_id = (SELECT get_my_company_id()) OR (SELECT is_super_admin()));

-- 3. Workshop bays
CREATE TABLE public.workshop_bays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.workshop_bays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view bays" ON public.workshop_bays FOR SELECT USING (company_id = (SELECT get_my_company_id()) OR (SELECT is_super_admin()));
CREATE POLICY "Company admins can insert bays" ON public.workshop_bays FOR INSERT WITH CHECK ((company_id = (SELECT get_my_company_id()) AND has_role((SELECT auth.uid()), 'admin')) OR (SELECT is_super_admin()));
CREATE POLICY "Company admins can update bays" ON public.workshop_bays FOR UPDATE USING ((company_id = (SELECT get_my_company_id()) AND has_role((SELECT auth.uid()), 'admin')) OR (SELECT is_super_admin()));
CREATE POLICY "Company admins can delete bays" ON public.workshop_bays FOR DELETE USING ((company_id = (SELECT get_my_company_id()) AND has_role((SELECT auth.uid()), 'admin')) OR (SELECT is_super_admin()));

-- 4. Add automotive columns to work_orders
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS work_order_type text;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS mileage_start integer;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS mileage_end integer;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS bay_id uuid REFERENCES public.workshop_bays(id) ON DELETE SET NULL;
