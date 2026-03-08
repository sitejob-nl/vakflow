
-- 1. Index op work_orders.vehicle_id
CREATE INDEX IF NOT EXISTS idx_work_orders_vehicle_id ON public.work_orders (vehicle_id);

-- 2. Index op work_orders.bay_id
CREATE INDEX IF NOT EXISTS idx_work_orders_bay_id ON public.work_orders (bay_id);

-- 3. Index op vehicles.company_id
CREATE INDEX IF NOT EXISTS idx_vehicles_company_id ON public.vehicles (company_id);

-- 4. FK apk_reminder_logs -> vehicles
ALTER TABLE public.apk_reminder_logs
  ADD CONSTRAINT apk_reminder_logs_vehicle_id_fkey
  FOREIGN KEY (vehicle_id) REFERENCES public.vehicles (id) ON DELETE CASCADE;

-- 5. Fix RLS: vehicles INSERT with check
DROP POLICY IF EXISTS "Company users can insert vehicles" ON public.vehicles;
CREATE POLICY "Company users can insert vehicles"
  ON public.vehicles FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT get_my_company_id()));

-- 6. Fix RLS: vehicle_mileage_logs INSERT with check
DROP POLICY IF EXISTS "Company users can insert vehicle_mileage_logs" ON public.vehicle_mileage_logs;
CREATE POLICY "Company users can insert vehicle_mileage_logs"
  ON public.vehicle_mileage_logs FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT get_my_company_id()));

-- 7. Fix RLS: apk_reminder_logs INSERT with check (already restrictive, update WITH CHECK)
DROP POLICY IF EXISTS "Company users can insert apk_reminder_logs" ON public.apk_reminder_logs;
CREATE POLICY "Company users can insert apk_reminder_logs"
  ON public.apk_reminder_logs FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT get_my_company_id()));
