
-- 1. Add avg_quality_score to assets
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS avg_quality_score numeric;

-- 2. Create quality_audits table
CREATE TABLE public.quality_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  auditor_id uuid REFERENCES public.profiles(id),
  audit_date date NOT NULL DEFAULT CURRENT_DATE,
  audit_type text NOT NULL DEFAULT 'internal',
  overall_score numeric,
  notes text,
  status text NOT NULL DEFAULT 'concept',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quality_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view quality_audits" ON public.quality_audits
  FOR SELECT TO authenticated
  USING (company_id = (SELECT get_my_company_id()) OR (SELECT is_super_admin()));

CREATE POLICY "Company users can insert quality_audits" ON public.quality_audits
  FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT get_my_company_id()));

CREATE POLICY "Company users can update quality_audits" ON public.quality_audits
  FOR UPDATE TO authenticated
  USING (company_id = (SELECT get_my_company_id()));

CREATE POLICY "Company users can delete quality_audits" ON public.quality_audits
  FOR DELETE TO authenticated
  USING (company_id = (SELECT get_my_company_id()));

-- 3. Create audit_room_scores table (own company_id for simpler RLS)
CREATE TABLE public.audit_room_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid NOT NULL REFERENCES public.quality_audits(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  room_id uuid REFERENCES public.object_rooms(id) ON DELETE SET NULL,
  room_name text NOT NULL,
  criteria jsonb NOT NULL DEFAULT '[]',
  score numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_room_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view audit_room_scores" ON public.audit_room_scores
  FOR SELECT TO authenticated
  USING (company_id = (SELECT get_my_company_id()) OR (SELECT is_super_admin()));

CREATE POLICY "Company users can insert audit_room_scores" ON public.audit_room_scores
  FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT get_my_company_id()));

CREATE POLICY "Company users can update audit_room_scores" ON public.audit_room_scores
  FOR UPDATE TO authenticated
  USING (company_id = (SELECT get_my_company_id()));

CREATE POLICY "Company users can delete audit_room_scores" ON public.audit_room_scores
  FOR DELETE TO authenticated
  USING (company_id = (SELECT get_my_company_id()));

-- 4. Trigger function: update avg_quality_score on assets
-- Filters on status='afgerond', specific asset_id and company_id, last 5 audits only
CREATE OR REPLACE FUNCTION public.update_asset_avg_quality_score()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  avg_score numeric;
BEGIN
  -- Only recalculate when status changes to/from 'afgerond'
  IF NEW.status = 'afgerond' OR (TG_OP = 'UPDATE' AND OLD.status = 'afgerond' AND NEW.status <> 'afgerond') THEN
    SELECT AVG(sub.overall_score) INTO avg_score
    FROM (
      SELECT overall_score
      FROM public.quality_audits
      WHERE asset_id = NEW.asset_id
        AND company_id = NEW.company_id
        AND status = 'afgerond'
        AND overall_score IS NOT NULL
      ORDER BY audit_date DESC, created_at DESC
      LIMIT 5
    ) sub;

    UPDATE public.assets
    SET avg_quality_score = ROUND(avg_score, 1)
    WHERE id = NEW.asset_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_asset_avg_quality_score
  AFTER INSERT OR UPDATE ON public.quality_audits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_asset_avg_quality_score();

-- 5. updated_at trigger for quality_audits
CREATE TRIGGER trg_quality_audits_updated_at
  BEFORE UPDATE ON public.quality_audits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
