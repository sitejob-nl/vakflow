
-- BUG 1: Drop duplicate trigger (keep trg_update_asset_maintenance which is AFTER UPDATE)
DROP TRIGGER IF EXISTS trg_update_asset_on_wo_complete ON public.work_orders;

-- BUG 2: work_orders.company_id NOT NULL
ALTER TABLE public.work_orders ALTER COLUMN company_id SET NOT NULL;

-- BUG 3: Company-scoped unique constraints for invoice/work_order numbers
ALTER TABLE public.work_orders DROP CONSTRAINT IF EXISTS work_orders_work_order_number_key;
ALTER TABLE public.work_orders ADD CONSTRAINT uq_wo_company_number UNIQUE (company_id, work_order_number);

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_key;
ALTER TABLE public.invoices ADD CONSTRAINT uq_inv_company_number UNIQUE (company_id, invoice_number);

-- BUG 4: Quote number unique per company
ALTER TABLE public.quotes ADD CONSTRAINT uq_quotes_company_number UNIQUE (company_id, quote_number);

-- BUG 5: Disable RLS on reference data table
ALTER TABLE public.rdw_defect_descriptions DISABLE ROW LEVEL SECURITY;

-- BUG 6: Mileage update trigger on work order completion
CREATE OR REPLACE FUNCTION public.update_vehicle_mileage_on_wo_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'afgerond' AND OLD.status IS DISTINCT FROM 'afgerond'
     AND NEW.vehicle_id IS NOT NULL AND NEW.mileage_end IS NOT NULL THEN
    UPDATE public.vehicles
    SET mileage_current = NEW.mileage_end
    WHERE id = NEW.vehicle_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_vehicle_mileage_on_wo_complete
  AFTER UPDATE ON public.work_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_vehicle_mileage_on_wo_complete();

-- BUG 7: Drop redundant next_maintenance_date column
ALTER TABLE public.assets DROP COLUMN IF EXISTS next_maintenance_date;

-- BUG 7: Rewrite trigger function to only use next_service_due (no next_maintenance_date reference)
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
        next_service_due = CURRENT_DATE + interval_val
    WHERE id = NEW.asset_id;

    INSERT INTO public.asset_maintenance_logs (asset_id, company_id, description, performed_by, work_order_id, maintenance_date)
    VALUES (NEW.asset_id, NEW.company_id, COALESCE(NEW.description, 'Onderhoud via werkbon ' || COALESCE(NEW.work_order_number, '')), NULL, NEW.id, CURRENT_DATE);
  END IF;
  RETURN NEW;
END;
$$;
