
-- 1. Extend assets table
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS object_type text NOT NULL DEFAULT 'building',
  ADD COLUMN IF NOT EXISTS frequency text DEFAULT 'weekly',
  ADD COLUMN IF NOT EXISTS frequency_days integer[],
  ADD COLUMN IF NOT EXISTS next_service_due date,
  ADD COLUMN IF NOT EXISTS surface_area integer,
  ADD COLUMN IF NOT EXISTS vehicle_count integer,
  ADD COLUMN IF NOT EXISTS facilities text[],
  ADD COLUMN IF NOT EXISTS access_instructions text;

-- 2. Create object_rooms table
CREATE TABLE public.object_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid REFERENCES public.assets(id) ON DELETE CASCADE NOT NULL,
  company_id uuid REFERENCES public.companies(id) NOT NULL,
  name text NOT NULL,
  room_type text,
  checklist jsonb DEFAULT '[]'::jsonb,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.object_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view object_rooms" ON public.object_rooms
  FOR SELECT TO authenticated
  USING (company_id = (SELECT get_my_company_id()));

CREATE POLICY "Company users can insert object_rooms" ON public.object_rooms
  FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT get_my_company_id()));

CREATE POLICY "Company users can update object_rooms" ON public.object_rooms
  FOR UPDATE TO authenticated
  USING (company_id = (SELECT get_my_company_id()));

CREATE POLICY "Company users can delete object_rooms" ON public.object_rooms
  FOR DELETE TO authenticated
  USING (company_id = (SELECT get_my_company_id()));

-- 3. Create fleet_vehicle_types table
CREATE TABLE public.fleet_vehicle_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid REFERENCES public.assets(id) ON DELETE CASCADE NOT NULL,
  company_id uuid REFERENCES public.companies(id) NOT NULL,
  vehicle_type text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  price_per_unit numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.fleet_vehicle_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view fleet_vehicle_types" ON public.fleet_vehicle_types
  FOR SELECT TO authenticated
  USING (company_id = (SELECT get_my_company_id()));

CREATE POLICY "Company users can insert fleet_vehicle_types" ON public.fleet_vehicle_types
  FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT get_my_company_id()));

CREATE POLICY "Company users can update fleet_vehicle_types" ON public.fleet_vehicle_types
  FOR UPDATE TO authenticated
  USING (company_id = (SELECT get_my_company_id()));

CREATE POLICY "Company users can delete fleet_vehicle_types" ON public.fleet_vehicle_types
  FOR DELETE TO authenticated
  USING (company_id = (SELECT get_my_company_id()));

-- 4. Extend work_orders
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS vehicles_washed jsonb,
  ADD COLUMN IF NOT EXISTS vehicles_washed_total integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS room_checklists jsonb;

-- 5. Trigger: calculate next_service_due on assets INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.calculate_next_service_due()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  base_date date;
  interval_val interval;
BEGIN
  -- Only calculate if frequency is set
  IF NEW.frequency IS NULL THEN
    RETURN NEW;
  END IF;

  -- Use last_maintenance_date as base, or install_date, or today
  base_date := COALESCE(NEW.last_maintenance_date, NEW.install_date, CURRENT_DATE);

  -- Calculate interval based on frequency
  CASE NEW.frequency
    WHEN 'daily' THEN interval_val := INTERVAL '1 day';
    WHEN '2x_week' THEN interval_val := INTERVAL '3 days';
    WHEN '3x_week' THEN interval_val := INTERVAL '2 days';
    WHEN 'weekly' THEN interval_val := INTERVAL '7 days';
    WHEN 'biweekly' THEN interval_val := INTERVAL '14 days';
    WHEN 'monthly' THEN interval_val := INTERVAL '1 month';
    WHEN 'quarterly' THEN interval_val := INTERVAL '3 months';
    WHEN 'yearly' THEN interval_val := INTERVAL '1 year';
    ELSE interval_val := INTERVAL '7 days';
  END CASE;

  NEW.next_service_due := base_date + interval_val;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_calculate_next_service_due
  BEFORE INSERT OR UPDATE OF frequency, last_maintenance_date, install_date
  ON public.assets
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_next_service_due();

-- 6. Update existing trigger to use frequency-based calculation
CREATE OR REPLACE FUNCTION public.update_asset_maintenance_on_wo_complete()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  asset_frequency text;
  interval_val interval;
BEGIN
  IF NEW.status = 'afgerond' AND OLD.status IS DISTINCT FROM 'afgerond' AND NEW.asset_id IS NOT NULL THEN
    -- Get asset frequency
    SELECT frequency INTO asset_frequency FROM public.assets WHERE id = NEW.asset_id;

    -- Calculate interval based on frequency
    CASE COALESCE(asset_frequency, 'monthly')
      WHEN 'daily' THEN interval_val := INTERVAL '1 day';
      WHEN '2x_week' THEN interval_val := INTERVAL '3 days';
      WHEN '3x_week' THEN interval_val := INTERVAL '2 days';
      WHEN 'weekly' THEN interval_val := INTERVAL '7 days';
      WHEN 'biweekly' THEN interval_val := INTERVAL '14 days';
      WHEN 'monthly' THEN interval_val := INTERVAL '1 month';
      WHEN 'quarterly' THEN interval_val := INTERVAL '3 months';
      WHEN 'yearly' THEN interval_val := INTERVAL '1 year';
      ELSE interval_val := INTERVAL '1 month' * COALESCE(
        (SELECT interval_months FROM public.customers WHERE id = NEW.customer_id), 24
      );
    END CASE;

    UPDATE public.assets
    SET last_maintenance_date = CURRENT_DATE,
        next_service_due = CURRENT_DATE + interval_val,
        next_maintenance_date = CURRENT_DATE + interval_val
    WHERE id = NEW.asset_id;

    INSERT INTO public.asset_maintenance_logs (asset_id, company_id, description, performed_by, work_order_id, maintenance_date)
    VALUES (NEW.asset_id, NEW.company_id, COALESCE(NEW.description, 'Onderhoud via werkbon ' || COALESCE(NEW.work_order_number, '')), NULL, NEW.id, CURRENT_DATE);
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate the trigger on work_orders (it already exists, just make sure function is updated)
DROP TRIGGER IF EXISTS trg_update_asset_maintenance ON public.work_orders;
CREATE TRIGGER trg_update_asset_maintenance
  AFTER UPDATE ON public.work_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_asset_maintenance_on_wo_complete();
