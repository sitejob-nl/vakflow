
-- =============================================
-- Combined migration: all tables, functions, triggers, RLS, storage
-- =============================================

-- 1. Profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  company_name text,
  location text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view profiles" ON public.profiles FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Services table
CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price numeric NOT NULL,
  color text,
  category text,
  checklist_template jsonb DEFAULT '[]'::jsonb,
  duration_minutes integer NOT NULL DEFAULT 60,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view services" ON public.services FOR SELECT USING (auth.uid() IS NOT NULL);

-- Seed services
INSERT INTO public.services (name, price, color, category, checklist_template) VALUES
  ('Basis reiniging', 125, 'primary', 'MV-reiniging', '[{"label":"Reinigen ventilatiekanalen","checked":false},{"label":"Ventilatieroosters reinigen","checked":false},{"label":"Reinigen ventielen","checked":false},{"label":"Ventilatieadvies","checked":false},{"label":"Voor-foto''s gemaakt","checked":false},{"label":"Na-foto''s gemaakt","checked":false}]'::jsonb),
  ('Uitgebreide reiniging', 155, 'accent', 'MV-reiniging', '[{"label":"Inspectie ventilatiebox","checked":false},{"label":"Reinigen ventilatiebox","checked":false},{"label":"Reinigen ventilatiekanalen","checked":false},{"label":"Ventilatieroosters reinigen","checked":false},{"label":"Inregelen ventilatie systeem","checked":false},{"label":"Reinigen ventielen","checked":false},{"label":"Ventilatieadvies","checked":false},{"label":"Voor-foto''s gemaakt","checked":false},{"label":"Na-foto''s gemaakt","checked":false}]'::jsonb),
  ('Klein onderhoud', 190, '#f59e0b', 'WTW onderhoud', '[{"label":"Inspectie WTW unit","checked":false},{"label":"Reinigen WTW unit","checked":false},{"label":"Onderhoud WTW unit","checked":false},{"label":"Reinigen ventilatiekanalen","checked":false},{"label":"Onderhoud toevoer & afvoermotor","checked":false},{"label":"Ventilatieadvies","checked":false},{"label":"Voor-foto''s gemaakt","checked":false},{"label":"Na-foto''s gemaakt","checked":false}]'::jsonb);

INSERT INTO public.services (name, price, category, checklist_template, color) VALUES
('Zehnder ComfoFan Silent - Euro', 565, 'MV-box vervangen', '[{"label":"MV-box vervangen","checked":false},{"label":"Aansluiting gecontroleerd","checked":false},{"label":"Systeem getest","checked":false},{"label":"Voor-foto''s gemaakt","checked":false},{"label":"Na-foto''s gemaakt","checked":false}]'::jsonb, '#6366f1'),
('Zehnder ComfoFan Silent - Perilex', 565, 'MV-box vervangen', '[{"label":"MV-box vervangen","checked":false},{"label":"Aansluiting gecontroleerd","checked":false},{"label":"Systeem getest","checked":false},{"label":"Voor-foto''s gemaakt","checked":false},{"label":"Na-foto''s gemaakt","checked":false}]'::jsonb, '#6366f1'),
('Duco DucoBox Silent - Euro', 535, 'MV-box vervangen', '[{"label":"MV-box vervangen","checked":false},{"label":"Aansluiting gecontroleerd","checked":false},{"label":"Systeem getest","checked":false},{"label":"Voor-foto''s gemaakt","checked":false},{"label":"Na-foto''s gemaakt","checked":false}]'::jsonb, '#6366f1'),
('Duco DucoBox Silent - Perilex', 535, 'MV-box vervangen', '[{"label":"MV-box vervangen","checked":false},{"label":"Aansluiting gecontroleerd","checked":false},{"label":"Systeem getest","checked":false},{"label":"Voor-foto''s gemaakt","checked":false},{"label":"Na-foto''s gemaakt","checked":false}]'::jsonb, '#6366f1'),
('Groot onderhoud', 275, 'WTW onderhoud', '[{"label":"Inspectie WTW unit","checked":false},{"label":"Reinigen WTW unit","checked":false},{"label":"Filters vervangen","checked":false},{"label":"Onderhoud WTW unit","checked":false},{"label":"Reinigen ventilatiekanalen","checked":false},{"label":"Inregelen ventilatie systeem","checked":false},{"label":"Onderhoud warmtewisselaar","checked":false},{"label":"Inspectie van toevoerkanalen","checked":false},{"label":"Onderhoud toevoer & afvoermotor","checked":false},{"label":"Ventilatieadvies","checked":false},{"label":"Meetrapport opgesteld","checked":false},{"label":"Voor-foto''s gemaakt","checked":false},{"label":"Na-foto''s gemaakt","checked":false}]'::jsonb, '#f59e0b'),
('Itho Daalderop WTW', 1995, 'WTW-unit vervangen', '[{"label":"WTW-unit vervangen","checked":false},{"label":"Aansluiting gecontroleerd","checked":false},{"label":"Systeem getest","checked":false},{"label":"Inregelen ventilatie systeem","checked":false},{"label":"Voor-foto''s gemaakt","checked":false},{"label":"Na-foto''s gemaakt","checked":false}]'::jsonb, '#ef4444'),
('Zehnder ComfoAir Q350', 3448.86, 'WTW-unit vervangen', '[{"label":"WTW-unit vervangen","checked":false},{"label":"Aansluiting gecontroleerd","checked":false},{"label":"Systeem getest","checked":false},{"label":"Inregelen ventilatie systeem","checked":false},{"label":"Voor-foto''s gemaakt","checked":false},{"label":"Na-foto''s gemaakt","checked":false}]'::jsonb, '#ef4444');

-- 3. Customers table
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'particulier',
  contact_person text,
  phone text,
  email text,
  address text,
  postal_code text,
  city text,
  default_service_id uuid REFERENCES public.services(id),
  interval_months integer NOT NULL DEFAULT 24,
  whatsapp_optin boolean NOT NULL DEFAULT false,
  notes text,
  lat numeric,
  lng numeric,
  eboekhouden_relation_id integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view customers" ON public.customers FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert customers" ON public.customers FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update customers" ON public.customers FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete customers" ON public.customers FOR DELETE USING (auth.uid() IS NOT NULL);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Addresses table
CREATE TABLE public.addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  street text,
  house_number text,
  apartment text,
  postal_code text,
  city text,
  notes text,
  last_service_date date,
  lat numeric,
  lng numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view addresses" ON public.addresses FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert addresses" ON public.addresses FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update addresses" ON public.addresses FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete addresses" ON public.addresses FOR DELETE USING (auth.uid() IS NOT NULL);

-- 5. Appointments table
CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services(id),
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  status text NOT NULL DEFAULT 'gepland',
  assigned_to uuid REFERENCES public.profiles(id),
  notes text,
  address_id uuid REFERENCES public.addresses(id) ON DELETE SET NULL,
  travel_time_minutes integer,
  start_location_label text,
  todos jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view appointments" ON public.appointments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert appointments" ON public.appointments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update appointments" ON public.appointments FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete appointments" ON public.appointments FOR DELETE USING (auth.uid() IS NOT NULL);

-- 6. Work orders table
CREATE TABLE public.work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_number text UNIQUE,
  appointment_id uuid REFERENCES public.appointments(id),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services(id),
  status text NOT NULL DEFAULT 'open',
  checklist jsonb DEFAULT '[]'::jsonb,
  remarks text,
  photos_before text[] DEFAULT '{}',
  photos_after text[] DEFAULT '{}',
  signature_url text,
  signed_by text,
  signed_at timestamptz,
  total_amount numeric,
  travel_cost numeric NOT NULL DEFAULT 0,
  address_id uuid REFERENCES public.addresses(id) ON DELETE SET NULL,
  description text,
  notes jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view work_orders" ON public.work_orders FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert work_orders" ON public.work_orders FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update work_orders" ON public.work_orders FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete work_orders" ON public.work_orders FOR DELETE USING (auth.uid() IS NOT NULL);

-- Auto-generate work order number
CREATE OR REPLACE FUNCTION public.generate_work_order_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  current_year text;
  next_seq integer;
BEGIN
  current_year := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(work_order_number FROM 9) AS integer)
  ), 0) + 1 INTO next_seq
  FROM public.work_orders
  WHERE work_order_number LIKE 'WB-' || current_year || '-%';
  NEW.work_order_number := 'WB-' || current_year || '-' || LPAD(next_seq::text, 4, '0');
  RETURN NEW;
END;
$$;
CREATE TRIGGER set_work_order_number
  BEFORE INSERT ON public.work_orders
  FOR EACH ROW
  WHEN (NEW.work_order_number IS NULL)
  EXECUTE FUNCTION public.generate_work_order_number();

-- 7. Invoices table
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE,
  work_order_id uuid REFERENCES public.work_orders(id),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  subtotal numeric NOT NULL DEFAULT 0,
  vat_percentage numeric NOT NULL DEFAULT 21,
  vat_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'concept',
  issued_at date,
  due_at date,
  paid_at date,
  eboekhouden_id text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  optional_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Auto-generate invoice number
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  current_year text;
  next_seq integer;
BEGIN
  current_year := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(invoice_number FROM 8) AS integer)
  ), 0) + 1 INTO next_seq
  FROM public.invoices
  WHERE invoice_number LIKE 'F-' || current_year || '-%';
  NEW.invoice_number := 'F-' || current_year || '-' || LPAD(next_seq::text, 3, '0');
  RETURN NEW;
END;
$$;
CREATE TRIGGER set_invoice_number
  BEFORE INSERT ON public.invoices
  FOR EACH ROW
  WHEN (NEW.invoice_number IS NULL)
  EXECUTE FUNCTION public.generate_invoice_number();

-- 8. Communication logs table
CREATE TABLE public.communication_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  work_order_id uuid REFERENCES public.work_orders(id),
  channel text NOT NULL,
  direction text NOT NULL DEFAULT 'outbound',
  subject text,
  body text,
  is_automated boolean NOT NULL DEFAULT false,
  template_name text,
  status text NOT NULL DEFAULT 'sent',
  sent_at timestamptz,
  message_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;

-- 9. Profiles extra columns
ALTER TABLE public.profiles ADD COLUMN onboarding_completed boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN smtp_email text;
ALTER TABLE public.profiles ADD COLUMN smtp_password text;
ALTER TABLE public.profiles ADD COLUMN smtp_host text DEFAULT 'smtp.transip.email';
ALTER TABLE public.profiles ADD COLUMN smtp_port integer DEFAULT 465;
ALTER TABLE public.profiles ADD COLUMN eboekhouden_template_id integer;
ALTER TABLE public.profiles ADD COLUMN eboekhouden_ledger_id integer;
ALTER TABLE public.profiles ADD COLUMN eboekhouden_api_token text;
ALTER TABLE public.profiles ADD COLUMN eboekhouden_debtor_ledger_id integer;
ALTER TABLE public.profiles ADD COLUMN kvk_number text;
ALTER TABLE public.profiles ADD COLUMN btw_number text;
ALTER TABLE public.profiles ADD COLUMN company_address text;
ALTER TABLE public.profiles ADD COLUMN company_postal_code text;
ALTER TABLE public.profiles ADD COLUMN company_city text;
ALTER TABLE public.profiles ADD COLUMN company_phone text;
ALTER TABLE public.profiles ADD COLUMN iban text;
ALTER TABLE public.profiles ADD COLUMN logo_url text;

-- 10. Quotes table
CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number text,
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  status text NOT NULL DEFAULT 'concept',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  optional_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL DEFAULT 0,
  vat_percentage numeric NOT NULL DEFAULT 21,
  vat_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  issued_at date,
  valid_until date,
  notes text,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own quotes" ON public.quotes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own quotes" ON public.quotes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own quotes" ON public.quotes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own quotes" ON public.quotes FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.generate_quote_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  current_year text;
  next_seq integer;
BEGIN
  current_year := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(quote_number FROM 8) AS integer)
  ), 0) + 1 INTO next_seq
  FROM public.quotes
  WHERE quote_number LIKE 'O-' || current_year || '-%';
  NEW.quote_number := 'O-' || current_year || '-' || LPAD(next_seq::text, 3, '0');
  RETURN NEW;
END;
$$;
CREATE TRIGGER set_quote_number
BEFORE INSERT ON public.quotes
FOR EACH ROW
EXECUTE FUNCTION public.generate_quote_number();

-- 11. User roles
CREATE TYPE public.app_role AS ENUM ('admin', 'monteur');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE POLICY "Authenticated users can view roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Assign admin to existing users
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users
ON CONFLICT DO NOTHING;

-- 12. Services admin-only write policies
CREATE POLICY "Admins can insert services"
ON public.services FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update services"
ON public.services FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete services"
ON public.services FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 13. Invoices admin-only policies
CREATE POLICY "Admins can view invoices"
ON public.invoices FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert invoices"
ON public.invoices FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update invoices"
ON public.invoices FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete invoices"
ON public.invoices FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 14. Communication logs admin-only policies
CREATE POLICY "Admins can view communication_logs"
ON public.communication_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert communication_logs"
ON public.communication_logs FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update communication_logs"
ON public.communication_logs FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete communication_logs"
ON public.communication_logs FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 15. WhatsApp config table
CREATE TABLE public.whatsapp_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number_id text NOT NULL,
  access_token text NOT NULL,
  display_phone text,
  waba_id text,
  tenant_id uuid,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;

-- 16. WhatsApp messages table
CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wamid text UNIQUE,
  direction text NOT NULL,
  from_number text,
  to_number text,
  content text,
  type text DEFAULT 'text',
  status text DEFAULT 'sent',
  sent_by uuid,
  customer_id uuid,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read messages" ON public.whatsapp_messages FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert messages" ON public.whatsapp_messages FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update messages" ON public.whatsapp_messages FOR UPDATE USING (auth.uid() IS NOT NULL);

-- 17. Todos table
CREATE TABLE public.todos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  due_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own todos" ON public.todos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own todos" ON public.todos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own todos" ON public.todos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own todos" ON public.todos FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_todos_user_id ON public.todos(user_id);

-- 18. Notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  link_page text,
  link_params jsonb,
  read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users can insert notifications" ON public.notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_notifications_user_unread ON public.notifications (user_id, read) WHERE read = false;
CREATE INDEX idx_notifications_user_created ON public.notifications (user_id, created_at DESC);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- 19. Notification triggers
CREATE OR REPLACE FUNCTION public.notify_on_whatsapp_incoming()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_id uuid;
  cust_name text;
BEGIN
  IF NEW.direction <> 'incoming' THEN
    RETURN NEW;
  END IF;
  SELECT name INTO cust_name FROM public.customers WHERE id = NEW.customer_id;
  FOR admin_id IN
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, title, body, link_page, link_params)
    VALUES (
      admin_id,
      'Nieuw WhatsApp bericht',
      COALESCE(cust_name, 'Onbekend') || ': ' || LEFT(COALESCE(NEW.content, '[media]'), 100),
      'whatsapp',
      '{}'::jsonb
    );
  END LOOP;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_notify_whatsapp_incoming
  AFTER INSERT ON public.whatsapp_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_whatsapp_incoming();

CREATE OR REPLACE FUNCTION public.notify_on_work_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_id uuid;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;
  FOR admin_id IN
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, title, body, link_page, link_params)
    VALUES (
      admin_id,
      'Werkbon status gewijzigd',
      COALESCE(NEW.work_order_number, 'Werkbon') || ' → ' || NEW.status,
      'woDetail',
      jsonb_build_object('workOrderId', NEW.id::text)
    );
  END LOOP;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_notify_work_order_status
  AFTER UPDATE ON public.work_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_work_order_status();

CREATE OR REPLACE FUNCTION public.notify_on_invoice_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_id uuid;
BEGIN
  IF OLD.status = 'betaald' OR NEW.status <> 'betaald' THEN
    RETURN NEW;
  END IF;
  FOR admin_id IN
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, title, body, link_page, link_params)
    VALUES (
      admin_id,
      'Factuur betaald',
      COALESCE(NEW.invoice_number, 'Factuur') || ' — €' || NEW.total::text,
      'invoices',
      '{}'::jsonb
    );
  END LOOP;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_notify_invoice_paid
  AFTER UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_invoice_paid();

-- 20. Auto message settings
CREATE TABLE public.auto_message_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  message_type text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  channel text NOT NULL DEFAULT 'whatsapp',
  template_name text,
  custom_text text,
  delay_hours integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, message_type)
);
ALTER TABLE public.auto_message_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own auto_message_settings" ON public.auto_message_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own auto_message_settings" ON public.auto_message_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own auto_message_settings" ON public.auto_message_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own auto_message_settings" ON public.auto_message_settings FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_auto_message_settings_updated_at
  BEFORE UPDATE ON public.auto_message_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 21. Quote templates
CREATE TABLE public.quote_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  optional_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.quote_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own templates" ON public.quote_templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own templates" ON public.quote_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own templates" ON public.quote_templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own templates" ON public.quote_templates FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_quote_templates_updated_at
  BEFORE UPDATE ON public.quote_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 22. WhatsApp automations
CREATE TABLE public.whatsapp_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  trigger_type text NOT NULL,
  template_name text NOT NULL,
  template_language text NOT NULL DEFAULT 'nl',
  variable_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  cooldown_hours integer NOT NULL DEFAULT 720,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_automations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own automations" ON public.whatsapp_automations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own automations" ON public.whatsapp_automations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own automations" ON public.whatsapp_automations FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own automations" ON public.whatsapp_automations FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_whatsapp_automations_updated_at
  BEFORE UPDATE ON public.whatsapp_automations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Automation send log
CREATE TABLE public.automation_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.whatsapp_automations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  trigger_type text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  result jsonb DEFAULT '{}'::jsonb
);
ALTER TABLE public.automation_send_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view send logs" ON public.automation_send_log FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert send logs" ON public.automation_send_log FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE INDEX idx_automation_send_log_lookup ON public.automation_send_log (automation_id, customer_id, sent_at DESC);

-- 23. Storage buckets (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('work-order-photos', 'work-order-photos', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('whatsapp-media', 'whatsapp-media', false) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload work order photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'work-order-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view work-order-photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'work-order-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete work order photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'work-order-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Service role can upload whatsapp media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'whatsapp-media');

CREATE POLICY "Authenticated users can view whatsapp-media"
ON storage.objects FOR SELECT
USING (bucket_id = 'whatsapp-media' AND auth.uid() IS NOT NULL);
