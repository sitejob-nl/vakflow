
-- Add asset_id column to work_orders
ALTER TABLE public.work_orders ADD COLUMN asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL;

-- Create trigger to auto-update asset maintenance dates when work order is completed
CREATE OR REPLACE FUNCTION public.update_asset_maintenance_on_wo_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fire when status changes to 'afgerond' and asset_id is set
  IF NEW.status = 'afgerond' AND OLD.status IS DISTINCT FROM 'afgerond' AND NEW.asset_id IS NOT NULL THEN
    -- Update asset maintenance dates
    UPDATE public.assets
    SET last_maintenance_date = CURRENT_DATE,
        next_maintenance_date = CURRENT_DATE + INTERVAL '1 month' * COALESCE(
          (SELECT interval_months FROM public.customers WHERE id = NEW.customer_id), 24
        )
    WHERE id = NEW.asset_id;

    -- Insert maintenance log entry
    INSERT INTO public.asset_maintenance_logs (asset_id, company_id, description, performed_by, work_order_id, maintenance_date)
    VALUES (NEW.asset_id, NEW.company_id, COALESCE(NEW.description, 'Onderhoud via werkbon ' || COALESCE(NEW.work_order_number, '')), NULL, NEW.id, CURRENT_DATE);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_asset_on_wo_complete
BEFORE UPDATE ON public.work_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_asset_maintenance_on_wo_complete();
