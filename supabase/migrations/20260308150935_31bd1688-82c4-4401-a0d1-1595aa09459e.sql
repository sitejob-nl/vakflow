
CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  key_hash text NOT NULL,
  key_prefix text NOT NULL,
  name text NOT NULL DEFAULT 'API Key',
  created_at timestamptz DEFAULT now(),
  last_used_at timestamptz,
  is_active boolean DEFAULT true
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members manage own keys" ON public.api_keys
  FOR ALL TO authenticated
  USING (company_id = (SELECT public.get_my_company_id()));
