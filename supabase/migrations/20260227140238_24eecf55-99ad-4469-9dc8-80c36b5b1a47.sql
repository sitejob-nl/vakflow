
-- FASE 1 DEEL A: Schema wijzigingen (zonder enum gebruik)

-- 1a. Companies tabel
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  kvk_number text,
  btw_number text,
  address text,
  postal_code text,
  city text,
  phone text,
  iban text,
  logo_url text,
  smtp_email text,
  smtp_password text,
  smtp_host text DEFAULT 'smtp.transip.email',
  smtp_port integer DEFAULT 465,
  eboekhouden_api_token text,
  eboekhouden_ledger_id integer,
  eboekhouden_template_id integer,
  eboekhouden_debtor_ledger_id integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- 1b. company_id kolommen
ALTER TABLE public.profiles ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.customers ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.addresses ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.appointments ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.work_orders ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.invoices ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.quotes ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.quote_templates ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.services ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.communication_logs ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.whatsapp_messages ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.whatsapp_automations ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.auto_message_settings ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.automation_send_log ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.todos ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.notifications ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.whatsapp_config ADD COLUMN company_id uuid REFERENCES public.companies(id);

-- 1c. user_roles
ALTER TABLE public.user_roles ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_company_id_role_key UNIQUE (user_id, company_id, role);

-- 1d. Security definer functies (geen super_admin enum referentie)
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid()
$$;

-- Service role policies (needed before data migration)
CREATE POLICY "Service role full access companies" ON public.companies
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access whatsapp_config" ON public.whatsapp_config
  FOR ALL TO service_role USING (true) WITH CHECK (true);
