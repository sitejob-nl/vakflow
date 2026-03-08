
-- Trade vehicles table for automotive trade-in & sales module
CREATE TABLE public.trade_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  -- Vehicle info
  license_plate text,
  brand text,
  model text,
  year integer,
  mileage integer,
  color text,
  fuel_type text,
  transmission text,
  vin text,
  -- Appraisal / taxatie
  appraisal_date date DEFAULT CURRENT_DATE,
  appraised_by uuid REFERENCES public.profiles(id),
  damage_checklist jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{area, severity, description, photo_url}]
  general_notes text,
  condition_score integer,  -- 1-10
  -- Pricing
  purchase_price numeric NOT NULL DEFAULT 0,
  estimated_repair_cost numeric NOT NULL DEFAULT 0,
  target_sell_price numeric NOT NULL DEFAULT 0,
  actual_sell_price numeric,
  -- Status
  status text NOT NULL DEFAULT 'intake',  -- intake, in_opknapbeurt, te_koop, verkocht, afgekeurd
  -- Linked work order for refurbishment
  work_order_id uuid REFERENCES public.work_orders(id),
  -- Customer links
  purchased_from_customer_id uuid REFERENCES public.customers(id),
  sold_to_customer_id uuid REFERENCES public.customers(id),
  sold_at date,
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_trade_vehicles_company_id ON public.trade_vehicles(company_id);
CREATE INDEX idx_trade_vehicles_status ON public.trade_vehicles(status);

-- RLS
ALTER TABLE public.trade_vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view trade_vehicles"
  ON public.trade_vehicles FOR SELECT TO authenticated
  USING (company_id = (SELECT get_my_company_id()) OR (SELECT is_super_admin()));

CREATE POLICY "Company users can insert trade_vehicles"
  ON public.trade_vehicles FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT get_my_company_id()));

CREATE POLICY "Company users can update trade_vehicles"
  ON public.trade_vehicles FOR UPDATE TO authenticated
  USING (company_id = (SELECT get_my_company_id()));

CREATE POLICY "Company admins can delete trade_vehicles"
  ON public.trade_vehicles FOR DELETE TO authenticated
  USING (company_id = (SELECT get_my_company_id()) AND has_role(auth.uid(), 'admin'));

-- Updated_at trigger
CREATE TRIGGER update_trade_vehicles_updated_at
  BEFORE UPDATE ON public.trade_vehicles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
