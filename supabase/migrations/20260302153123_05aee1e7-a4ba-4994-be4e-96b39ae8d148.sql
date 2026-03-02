
-- Materials catalog per company
CREATE TABLE public.materials (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES public.companies(id),
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'stuk',
  unit_price numeric NOT NULL DEFAULT 0,
  article_number text,
  category text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_materials_company ON public.materials(company_id);

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view materials"
  ON public.materials FOR SELECT
  USING (company_id = get_my_company_id() OR is_super_admin());

CREATE POLICY "Company users can insert materials"
  ON public.materials FOR INSERT
  WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "Company users can update materials"
  ON public.materials FOR UPDATE
  USING (company_id = get_my_company_id());

CREATE POLICY "Company users can delete materials"
  ON public.materials FOR DELETE
  USING (company_id = get_my_company_id());

-- Material usage per work order
CREATE TABLE public.work_order_materials (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES public.companies(id),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  material_id uuid REFERENCES public.materials(id) ON DELETE SET NULL,
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'stuk',
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wo_materials_work_order ON public.work_order_materials(work_order_id);
CREATE INDEX idx_wo_materials_company ON public.work_order_materials(company_id);

ALTER TABLE public.work_order_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view work_order_materials"
  ON public.work_order_materials FOR SELECT
  USING (company_id = get_my_company_id() OR is_super_admin());

CREATE POLICY "Company users can insert work_order_materials"
  ON public.work_order_materials FOR INSERT
  WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "Company users can update work_order_materials"
  ON public.work_order_materials FOR UPDATE
  USING (company_id = get_my_company_id());

CREATE POLICY "Company users can delete work_order_materials"
  ON public.work_order_materials FOR DELETE
  USING (company_id = get_my_company_id());
