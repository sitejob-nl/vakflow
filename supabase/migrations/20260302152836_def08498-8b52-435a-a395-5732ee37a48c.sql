
-- Time entries table for start/stop time tracking on work orders
CREATE TABLE public.time_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES public.companies(id),
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  stopped_at timestamptz,
  duration_minutes integer, -- computed on stop, or manual entry
  description text,
  is_travel boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_time_entries_work_order ON public.time_entries(work_order_id);
CREATE INDEX idx_time_entries_user ON public.time_entries(user_id);
CREATE INDEX idx_time_entries_company ON public.time_entries(company_id);

-- Enable RLS
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- RLS policies (same pattern as work_orders)
CREATE POLICY "Company users can view time_entries"
  ON public.time_entries FOR SELECT
  USING (company_id = get_my_company_id() OR is_super_admin());

CREATE POLICY "Company users can insert time_entries"
  ON public.time_entries FOR INSERT
  WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "Company users can update time_entries"
  ON public.time_entries FOR UPDATE
  USING (company_id = get_my_company_id());

CREATE POLICY "Company users can delete time_entries"
  ON public.time_entries FOR DELETE
  USING (company_id = get_my_company_id());
