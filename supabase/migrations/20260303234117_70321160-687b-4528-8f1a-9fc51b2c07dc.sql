
-- 1. Per-user Outlook tokens
CREATE TABLE public.user_outlook_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  outlook_refresh_token text NOT NULL,
  outlook_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_outlook_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own token" ON public.user_outlook_tokens
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can insert own token" ON public.user_outlook_tokens
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can update own token" ON public.user_outlook_tokens
  FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can delete own token" ON public.user_outlook_tokens
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

-- 2. Outlook event overrides (pin + location for route optimization)
CREATE TABLE public.outlook_event_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  outlook_event_id text NOT NULL,
  pinned boolean NOT NULL DEFAULT false,
  location_override text,
  lat numeric,
  lng numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(outlook_event_id, user_id)
);

ALTER TABLE public.outlook_event_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view overrides" ON public.outlook_event_overrides
  FOR SELECT TO authenticated USING (company_id = (SELECT get_my_company_id()));
CREATE POLICY "Company users can insert overrides" ON public.outlook_event_overrides
  FOR INSERT TO authenticated WITH CHECK (company_id = (SELECT get_my_company_id()));
CREATE POLICY "Company users can update overrides" ON public.outlook_event_overrides
  FOR UPDATE TO authenticated USING (company_id = (SELECT get_my_company_id()));
CREATE POLICY "Company users can delete overrides" ON public.outlook_event_overrides
  FOR DELETE TO authenticated USING (company_id = (SELECT get_my_company_id()));

-- 3. Add outlook_event_id to appointments for bidirectional sync
ALTER TABLE public.appointments ADD COLUMN outlook_event_id text;
