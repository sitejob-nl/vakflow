
-- Add stock tracking columns to materials
ALTER TABLE materials
  ADD COLUMN stock_quantity numeric NOT NULL DEFAULT 0,
  ADD COLUMN min_stock_level numeric NOT NULL DEFAULT 0;

-- Function to auto-deduct stock when work order is completed
CREATE OR REPLACE FUNCTION public.deduct_stock_on_wo_complete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'afgerond' AND OLD.status IS DISTINCT FROM 'afgerond' THEN
    UPDATE materials m
    SET stock_quantity = GREATEST(m.stock_quantity - wom.quantity, 0)
    FROM work_order_materials wom
    WHERE wom.work_order_id = NEW.id
      AND wom.material_id = m.id;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger on work_orders
CREATE TRIGGER trg_deduct_stock_on_wo_complete
  AFTER UPDATE ON work_orders
  FOR EACH ROW EXECUTE FUNCTION public.deduct_stock_on_wo_complete();
