
-- The projects table, RLS, function already exist. Just need the trigger to be idempotent, phases table, and FK columns.

-- Drop and recreate trigger to be safe
DROP TRIGGER IF EXISTS set_project_number ON public.projects;
CREATE TRIGGER set_project_number
  BEFORE INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION generate_project_number();

-- Project phases table (IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS public.project_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'gepland',
  start_date date,
  end_date date,
  budget_amount numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_phases ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_phases' AND policyname = 'Company users can view project_phases') THEN
    CREATE POLICY "Company users can view project_phases" ON public.project_phases FOR SELECT TO authenticated USING (company_id = (SELECT get_my_company_id()) OR (SELECT is_super_admin()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_phases' AND policyname = 'Company users can insert project_phases') THEN
    CREATE POLICY "Company users can insert project_phases" ON public.project_phases FOR INSERT TO authenticated WITH CHECK (company_id = (SELECT get_my_company_id()) OR (SELECT is_super_admin()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_phases' AND policyname = 'Company users can update project_phases') THEN
    CREATE POLICY "Company users can update project_phases" ON public.project_phases FOR UPDATE TO authenticated USING (company_id = (SELECT get_my_company_id()) OR (SELECT is_super_admin()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_phases' AND policyname = 'Company users can delete project_phases') THEN
    CREATE POLICY "Company users can delete project_phases" ON public.project_phases FOR DELETE TO authenticated USING (company_id = (SELECT get_my_company_id()) OR (SELECT is_super_admin()));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_project_phases_project_id ON project_phases(project_id);

-- FK's on existing tables
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS project_phase_id uuid REFERENCES project_phases(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_work_orders_project_id ON work_orders(project_id);

ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_time_entries_project_id ON time_entries(project_id);
