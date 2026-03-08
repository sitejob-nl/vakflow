-- Probleem 3: NOT NULL on company_id for 8 tables
ALTER TABLE invoices ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE customers ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE appointments ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE assets ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE quotes ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE services ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE materials ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE work_order_materials ALTER COLUMN company_id SET NOT NULL;

-- Probleem 6: vehicle_id on appointments
ALTER TABLE appointments ADD COLUMN vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL;

-- Probleem 7: Extend mileage trigger to also insert into vehicle_mileage_logs
CREATE OR REPLACE FUNCTION update_vehicle_mileage_on_wo_complete()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'afgerond' AND OLD.status IS DISTINCT FROM 'afgerond'
     AND NEW.vehicle_id IS NOT NULL AND NEW.mileage_end IS NOT NULL THEN
    -- Update current mileage on vehicle
    UPDATE public.vehicles
    SET mileage_current = NEW.mileage_end
    WHERE id = NEW.vehicle_id;

    -- Insert mileage log entry (replaces frontend INSERT)
    INSERT INTO public.vehicle_mileage_logs (vehicle_id, company_id, mileage, work_order_id, recorded_at)
    VALUES (NEW.vehicle_id, NEW.company_id, NEW.mileage_end, NEW.id, now());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;