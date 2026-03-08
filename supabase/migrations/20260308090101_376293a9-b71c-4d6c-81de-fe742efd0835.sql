
-- Cache table for RDW defect descriptions (gebrekbeschrijvingen)
-- Prevents fetching ~200KB from RDW API on every lookup call
CREATE TABLE public.rdw_defect_descriptions (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No RLS needed — only accessed via service role from edge functions
ALTER TABLE public.rdw_defect_descriptions ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (no public policies)
COMMENT ON TABLE public.rdw_defect_descriptions IS 'Cache of RDW gebrek descriptions, refreshed weekly by rdw-lookup edge function';
