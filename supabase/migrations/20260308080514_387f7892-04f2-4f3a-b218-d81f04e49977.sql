
-- Table to track sent APK reminders and avoid duplicates
CREATE TABLE public.apk_reminder_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  reminder_type text NOT NULL, -- '30d', '14d', '7d', '1d'
  channel text NOT NULL DEFAULT 'email',
  apk_expiry_date date NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.apk_reminder_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view apk_reminder_logs"
  ON public.apk_reminder_logs FOR SELECT
  USING (company_id = (SELECT get_my_company_id()) OR (SELECT is_super_admin()));

CREATE POLICY "Service role can insert apk_reminder_logs"
  ON public.apk_reminder_logs FOR INSERT
  WITH CHECK (true);

-- Index for dedup lookups
CREATE INDEX idx_apk_reminder_dedup 
  ON public.apk_reminder_logs (vehicle_id, reminder_type, apk_expiry_date);

-- APK reminder settings per company
CREATE TABLE public.apk_reminder_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  channel text NOT NULL DEFAULT 'email',
  days_before integer[] NOT NULL DEFAULT '{30,14,7}',
  email_subject text DEFAULT 'Uw APK verloopt binnenkort',
  email_body text DEFAULT 'Beste {{klantnaam}}, de APK van uw voertuig {{kenteken}} verloopt op {{apk_datum}}. Neem contact met ons op om een afspraak te maken.',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.apk_reminder_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view apk_reminder_settings"
  ON public.apk_reminder_settings FOR SELECT
  USING (company_id = (SELECT get_my_company_id()) OR (SELECT is_super_admin()));

CREATE POLICY "Company admins can manage apk_reminder_settings"
  ON public.apk_reminder_settings FOR ALL
  USING (company_id = (SELECT get_my_company_id()) AND has_role(auth.uid(), 'admin'))
  WITH CHECK (company_id = (SELECT get_my_company_id()) AND has_role(auth.uid(), 'admin'));
