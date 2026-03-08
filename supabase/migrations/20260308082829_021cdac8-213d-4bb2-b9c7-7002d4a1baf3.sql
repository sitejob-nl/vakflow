
-- Tire storage table
CREATE TABLE public.tire_storage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE CASCADE NOT NULL,
  season text NOT NULL DEFAULT 'zomer',
  brand text,
  size text,
  dot_code text,
  tread_depth_fl numeric,
  tread_depth_fr numeric,
  tread_depth_rl numeric,
  tread_depth_rr numeric,
  location_code text,
  status text NOT NULL DEFAULT 'opgeslagen',
  notes text,
  stored_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tire_storage ENABLE ROW LEVEL SECURITY;

-- RLS policies (same pattern as other company tables)
CREATE POLICY "Company users can view tire_storage"
  ON public.tire_storage FOR SELECT TO authenticated
  USING ((company_id = (SELECT get_my_company_id())) OR (SELECT is_super_admin()));

CREATE POLICY "Company users can insert tire_storage"
  ON public.tire_storage FOR INSERT TO authenticated
  WITH CHECK ((company_id = (SELECT get_my_company_id())) OR (SELECT is_super_admin()));

CREATE POLICY "Company users can update tire_storage"
  ON public.tire_storage FOR UPDATE TO authenticated
  USING ((company_id = (SELECT get_my_company_id())) OR (SELECT is_super_admin()));

CREATE POLICY "Company users can delete tire_storage"
  ON public.tire_storage FOR DELETE TO authenticated
  USING ((company_id = (SELECT get_my_company_id())) OR (SELECT is_super_admin()));

-- Index for fast lookups
CREATE INDEX idx_tire_storage_vehicle ON public.tire_storage(vehicle_id);
CREATE INDEX idx_tire_storage_company ON public.tire_storage(company_id);
