
-- Create edge_function_errors table for centralized error logging
CREATE TABLE public.edge_function_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  function_name text NOT NULL,
  error_message text NOT NULL,
  error_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  severity text NOT NULL DEFAULT 'error',
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for quick lookups
CREATE INDEX idx_edge_function_errors_created ON public.edge_function_errors(created_at DESC);
CREATE INDEX idx_edge_function_errors_resolved ON public.edge_function_errors(resolved) WHERE NOT resolved;

-- Enable RLS
ALTER TABLE public.edge_function_errors ENABLE ROW LEVEL SECURITY;

-- Only super admins can view errors
CREATE POLICY "Super admins can view errors"
  ON public.edge_function_errors
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_super_admin()));

-- Only super admins can update (mark resolved)
CREATE POLICY "Super admins can update errors"
  ON public.edge_function_errors
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_super_admin()));
