
-- FASE 1 DEEL B: Functies, RLS policies, data migratie

-- is_super_admin functie (nu kan super_admin enum gebruikt worden)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
$$;

-- ========== RLS POLICIES ==========

-- COMPANIES
CREATE POLICY "Users can view own company" ON public.companies
  FOR SELECT TO authenticated USING (id = public.get_my_company_id() OR public.is_super_admin());
CREATE POLICY "Admins can update own company" ON public.companies
  FOR UPDATE TO authenticated
  USING (id = public.get_my_company_id() AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (id = public.get_my_company_id() AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Super admins can manage companies" ON public.companies
  FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
CREATE POLICY "Super admins can delete companies" ON public.companies
  FOR DELETE TO authenticated USING (public.is_super_admin());

-- PROFILES
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can view company profiles" ON public.profiles
  FOR SELECT TO authenticated USING (company_id = public.get_my_company_id() OR public.is_super_admin() OR id = auth.uid());
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());

-- CUSTOMERS
DROP POLICY IF EXISTS "Authenticated users can view customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can update customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can delete customers" ON public.customers;

CREATE POLICY "Company users can view customers" ON public.customers FOR SELECT TO authenticated USING (company_id = public.get_my_company_id() OR public.is_super_admin());
CREATE POLICY "Company users can insert customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (company_id = public.get_my_company_id());
CREATE POLICY "Company users can update customers" ON public.customers FOR UPDATE TO authenticated USING (company_id = public.get_my_company_id());
CREATE POLICY "Company users can delete customers" ON public.customers FOR DELETE TO authenticated USING (company_id = public.get_my_company_id());

-- ADDRESSES
DROP POLICY IF EXISTS "Authenticated users can view addresses" ON public.addresses;
DROP POLICY IF EXISTS "Authenticated users can insert addresses" ON public.addresses;
DROP POLICY IF EXISTS "Authenticated users can update addresses" ON public.addresses;
DROP POLICY IF EXISTS "Authenticated users can delete addresses" ON public.addresses;

CREATE POLICY "Company users can view addresses" ON public.addresses FOR SELECT TO authenticated USING (company_id = public.get_my_company_id() OR public.is_super_admin());
CREATE POLICY "Company users can insert addresses" ON public.addresses FOR INSERT TO authenticated WITH CHECK (company_id = public.get_my_company_id());
CREATE POLICY "Company users can update addresses" ON public.addresses FOR UPDATE TO authenticated USING (company_id = public.get_my_company_id());
CREATE POLICY "Company users can delete addresses" ON public.addresses FOR DELETE TO authenticated USING (company_id = public.get_my_company_id());

-- APPOINTMENTS
DROP POLICY IF EXISTS "Authenticated users can view appointments" ON public.appointments;
DROP POLICY IF EXISTS "Authenticated users can insert appointments" ON public.appointments;
DROP POLICY IF EXISTS "Authenticated users can update appointments" ON public.appointments;
DROP POLICY IF EXISTS "Authenticated users can delete appointments" ON public.appointments;

CREATE POLICY "Company users can view appointments" ON public.appointments FOR SELECT TO authenticated USING (company_id = public.get_my_company_id() OR public.is_super_admin());
CREATE POLICY "Company users can insert appointments" ON public.appointments FOR INSERT TO authenticated WITH CHECK (company_id = public.get_my_company_id());
CREATE POLICY "Company users can update appointments" ON public.appointments FOR UPDATE TO authenticated USING (company_id = public.get_my_company_id());
CREATE POLICY "Company users can delete appointments" ON public.appointments FOR DELETE TO authenticated USING (company_id = public.get_my_company_id());

-- WORK_ORDERS
DROP POLICY IF EXISTS "Authenticated users can view work_orders" ON public.work_orders;
DROP POLICY IF EXISTS "Authenticated users can insert work_orders" ON public.work_orders;
DROP POLICY IF EXISTS "Authenticated users can update work_orders" ON public.work_orders;
DROP POLICY IF EXISTS "Authenticated users can delete work_orders" ON public.work_orders;

CREATE POLICY "Company users can view work_orders" ON public.work_orders FOR SELECT TO authenticated USING (company_id = public.get_my_company_id() OR public.is_super_admin());
CREATE POLICY "Company users can insert work_orders" ON public.work_orders FOR INSERT TO authenticated WITH CHECK (company_id = public.get_my_company_id());
CREATE POLICY "Company users can update work_orders" ON public.work_orders FOR UPDATE TO authenticated USING (company_id = public.get_my_company_id());
CREATE POLICY "Company users can delete work_orders" ON public.work_orders FOR DELETE TO authenticated USING (company_id = public.get_my_company_id());

-- INVOICES
DROP POLICY IF EXISTS "Admins can view invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admins can insert invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admins can update invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admins can delete invoices" ON public.invoices;

CREATE POLICY "Company admins can view invoices" ON public.invoices FOR SELECT TO authenticated USING (company_id = public.get_my_company_id() OR public.is_super_admin());
CREATE POLICY "Company admins can insert invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (company_id = public.get_my_company_id() AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Company admins can update invoices" ON public.invoices FOR UPDATE TO authenticated USING (company_id = public.get_my_company_id() AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Company admins can delete invoices" ON public.invoices FOR DELETE TO authenticated USING (company_id = public.get_my_company_id() AND public.has_role(auth.uid(), 'admin'));

-- QUOTES
DROP POLICY IF EXISTS "Users can view own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Users can insert own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Users can update own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Users can delete own quotes" ON public.quotes;

CREATE POLICY "Company users can view quotes" ON public.quotes FOR SELECT TO authenticated USING (company_id = public.get_my_company_id() OR public.is_super_admin());
CREATE POLICY "Company users can insert quotes" ON public.quotes FOR INSERT TO authenticated WITH CHECK (company_id = public.get_my_company_id());
CREATE POLICY "Company users can update quotes" ON public.quotes FOR UPDATE TO authenticated USING (company_id = public.get_my_company_id());
CREATE POLICY "Company users can delete quotes" ON public.quotes FOR DELETE TO authenticated USING (company_id = public.get_my_company_id());

-- QUOTE_TEMPLATES
DROP POLICY IF EXISTS "Users can view own templates" ON public.quote_templates;
DROP POLICY IF EXISTS "Users can insert own templates" ON public.quote_templates;
DROP POLICY IF EXISTS "Users can update own templates" ON public.quote_templates;
DROP POLICY IF EXISTS "Users can delete own templates" ON public.quote_templates;

CREATE POLICY "Company users can view templates" ON public.quote_templates FOR SELECT TO authenticated USING (company_id = public.get_my_company_id() OR public.is_super_admin());
CREATE POLICY "Company users can insert templates" ON public.quote_templates FOR INSERT TO authenticated WITH CHECK (company_id = public.get_my_company_id());
CREATE POLICY "Company users can update templates" ON public.quote_templates FOR UPDATE TO authenticated USING (company_id = public.get_my_company_id());
CREATE POLICY "Company users can delete templates" ON public.quote_templates FOR DELETE TO authenticated USING (company_id = public.get_my_company_id());

-- SERVICES
DROP POLICY IF EXISTS "Authenticated users can view services" ON public.services;
DROP POLICY IF EXISTS "Admins can insert services" ON public.services;
DROP POLICY IF EXISTS "Admins can update services" ON public.services;
DROP POLICY IF EXISTS "Admins can delete services" ON public.services;

CREATE POLICY "Company users can view services" ON public.services FOR SELECT TO authenticated USING (company_id = public.get_my_company_id() OR public.is_super_admin());
CREATE POLICY "Company admins can insert services" ON public.services FOR INSERT TO authenticated WITH CHECK (company_id = public.get_my_company_id() AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Company admins can update services" ON public.services FOR UPDATE TO authenticated USING (company_id = public.get_my_company_id() AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Company admins can delete services" ON public.services FOR DELETE TO authenticated USING (company_id = public.get_my_company_id() AND public.has_role(auth.uid(), 'admin'));

-- COMMUNICATION_LOGS
DROP POLICY IF EXISTS "Admins can view communication_logs" ON public.communication_logs;
DROP POLICY IF EXISTS "Admins can insert communication_logs" ON public.communication_logs;
DROP POLICY IF EXISTS "Admins can update communication_logs" ON public.communication_logs;
DROP POLICY IF EXISTS "Admins can delete communication_logs" ON public.communication_logs;

CREATE POLICY "Company users can view communication_logs" ON public.communication_logs FOR SELECT TO authenticated USING (company_id = public.get_my_company_id() OR public.is_super_admin());
CREATE POLICY "Company users can insert communication_logs" ON public.communication_logs FOR INSERT TO authenticated WITH CHECK (company_id = public.get_my_company_id());
CREATE POLICY "Company users can update communication_logs" ON public.communication_logs FOR UPDATE TO authenticated USING (company_id = public.get_my_company_id());
CREATE POLICY "Company users can delete communication_logs" ON public.communication_logs FOR DELETE TO authenticated USING (company_id = public.get_my_company_id());

-- WHATSAPP_MESSAGES
DROP POLICY IF EXISTS "Authenticated users can read messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Authenticated users can insert messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Authenticated users can update messages" ON public.whatsapp_messages;

CREATE POLICY "Company users can view whatsapp_messages" ON public.whatsapp_messages FOR SELECT TO authenticated USING (company_id = public.get_my_company_id() OR public.is_super_admin());
CREATE POLICY "Company users can insert whatsapp_messages" ON public.whatsapp_messages FOR INSERT TO authenticated WITH CHECK (company_id = public.get_my_company_id());
CREATE POLICY "Company users can update whatsapp_messages" ON public.whatsapp_messages FOR UPDATE TO authenticated USING (company_id = public.get_my_company_id());

-- WHATSAPP_CONFIG
CREATE POLICY "Company users can view whatsapp_config" ON public.whatsapp_config FOR SELECT TO authenticated USING (company_id = public.get_my_company_id() OR public.is_super_admin());
CREATE POLICY "Company admins can insert whatsapp_config" ON public.whatsapp_config FOR INSERT TO authenticated WITH CHECK (company_id = public.get_my_company_id());
CREATE POLICY "Company admins can update whatsapp_config" ON public.whatsapp_config FOR UPDATE TO authenticated USING (company_id = public.get_my_company_id());
CREATE POLICY "Company admins can delete whatsapp_config" ON public.whatsapp_config FOR DELETE TO authenticated USING (company_id = public.get_my_company_id());

-- WHATSAPP_AUTOMATIONS
DROP POLICY IF EXISTS "Users can view own automations" ON public.whatsapp_automations;
DROP POLICY IF EXISTS "Users can insert own automations" ON public.whatsapp_automations;
DROP POLICY IF EXISTS "Users can update own automations" ON public.whatsapp_automations;
DROP POLICY IF EXISTS "Users can delete own automations" ON public.whatsapp_automations;

CREATE POLICY "Company users can view automations" ON public.whatsapp_automations FOR SELECT TO authenticated USING (company_id = public.get_my_company_id() OR public.is_super_admin());
CREATE POLICY "Company users can insert automations" ON public.whatsapp_automations FOR INSERT TO authenticated WITH CHECK (company_id = public.get_my_company_id());
CREATE POLICY "Company users can update automations" ON public.whatsapp_automations FOR UPDATE TO authenticated USING (company_id = public.get_my_company_id());
CREATE POLICY "Company users can delete automations" ON public.whatsapp_automations FOR DELETE TO authenticated USING (company_id = public.get_my_company_id());

-- AUTO_MESSAGE_SETTINGS
DROP POLICY IF EXISTS "Users can view own auto_message_settings" ON public.auto_message_settings;
DROP POLICY IF EXISTS "Users can insert own auto_message_settings" ON public.auto_message_settings;
DROP POLICY IF EXISTS "Users can update own auto_message_settings" ON public.auto_message_settings;
DROP POLICY IF EXISTS "Users can delete own auto_message_settings" ON public.auto_message_settings;

CREATE POLICY "Company users can view auto_message_settings" ON public.auto_message_settings FOR SELECT TO authenticated USING (company_id = public.get_my_company_id() OR public.is_super_admin());
CREATE POLICY "Company users can insert auto_message_settings" ON public.auto_message_settings FOR INSERT TO authenticated WITH CHECK (company_id = public.get_my_company_id());
CREATE POLICY "Company users can update auto_message_settings" ON public.auto_message_settings FOR UPDATE TO authenticated USING (company_id = public.get_my_company_id());
CREATE POLICY "Company users can delete auto_message_settings" ON public.auto_message_settings FOR DELETE TO authenticated USING (company_id = public.get_my_company_id());

-- AUTOMATION_SEND_LOG
DROP POLICY IF EXISTS "Authenticated users can view send logs" ON public.automation_send_log;
DROP POLICY IF EXISTS "Authenticated users can insert send logs" ON public.automation_send_log;

CREATE POLICY "Company users can view send logs" ON public.automation_send_log FOR SELECT TO authenticated USING (company_id = public.get_my_company_id() OR public.is_super_admin());
CREATE POLICY "Company users can insert send logs" ON public.automation_send_log FOR INSERT TO authenticated WITH CHECK (company_id = public.get_my_company_id());

-- TODOS
DROP POLICY IF EXISTS "Users can view own todos" ON public.todos;
DROP POLICY IF EXISTS "Users can insert own todos" ON public.todos;
DROP POLICY IF EXISTS "Users can update own todos" ON public.todos;
DROP POLICY IF EXISTS "Users can delete own todos" ON public.todos;

CREATE POLICY "Company users can view todos" ON public.todos FOR SELECT TO authenticated USING (company_id = public.get_my_company_id() OR public.is_super_admin());
CREATE POLICY "Company users can insert todos" ON public.todos FOR INSERT TO authenticated WITH CHECK (company_id = public.get_my_company_id());
CREATE POLICY "Company users can update todos" ON public.todos FOR UPDATE TO authenticated USING (company_id = public.get_my_company_id());
CREATE POLICY "Company users can delete todos" ON public.todos FOR DELETE TO authenticated USING (company_id = public.get_my_company_id());

-- NOTIFICATIONS
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;

CREATE POLICY "Company users can view notifications" ON public.notifications FOR SELECT TO authenticated USING (company_id = public.get_my_company_id() OR user_id = auth.uid() OR public.is_super_admin());
CREATE POLICY "Company users can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (company_id = public.get_my_company_id() OR public.is_super_admin());
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());

-- USER_ROLES
DROP POLICY IF EXISTS "Authenticated users can view roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

CREATE POLICY "Company users can view roles" ON public.user_roles FOR SELECT TO authenticated USING (company_id = public.get_my_company_id() OR public.is_super_admin() OR user_id = auth.uid());
CREATE POLICY "Company admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (company_id = public.get_my_company_id() AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Company admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (company_id = public.get_my_company_id() AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Company admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (company_id = public.get_my_company_id() AND public.has_role(auth.uid(), 'admin'));

-- ========== DATA MIGRATIE ==========
DO $$
DECLARE
  admin_user_id uuid;
  new_company_id uuid;
  admin_profile record;
BEGIN
  SELECT user_id INTO admin_user_id FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  IF admin_user_id IS NULL THEN
    SELECT id INTO admin_user_id FROM public.profiles LIMIT 1;
  END IF;
  IF admin_user_id IS NULL THEN RETURN; END IF;

  SELECT * INTO admin_profile FROM public.profiles WHERE id = admin_user_id;

  INSERT INTO public.companies (name, slug, kvk_number, btw_number, address, postal_code, city, phone, iban, logo_url, smtp_email, smtp_password, smtp_host, smtp_port, eboekhouden_api_token, eboekhouden_ledger_id, eboekhouden_template_id, eboekhouden_debtor_ledger_id)
  VALUES (
    COALESCE(admin_profile.company_name, 'Mijn Bedrijf'),
    LOWER(REGEXP_REPLACE(COALESCE(admin_profile.company_name, 'mijn-bedrijf'), '[^a-zA-Z0-9]+', '-', 'g')),
    admin_profile.kvk_number, admin_profile.btw_number, admin_profile.company_address,
    admin_profile.company_postal_code, admin_profile.company_city, admin_profile.company_phone,
    admin_profile.iban, admin_profile.logo_url, admin_profile.smtp_email, admin_profile.smtp_password,
    admin_profile.smtp_host, admin_profile.smtp_port, admin_profile.eboekhouden_api_token,
    admin_profile.eboekhouden_ledger_id, admin_profile.eboekhouden_template_id, admin_profile.eboekhouden_debtor_ledger_id
  ) RETURNING id INTO new_company_id;

  UPDATE public.profiles SET company_id = new_company_id WHERE company_id IS NULL;
  UPDATE public.customers SET company_id = new_company_id WHERE company_id IS NULL;
  UPDATE public.addresses SET company_id = new_company_id WHERE company_id IS NULL;
  UPDATE public.appointments SET company_id = new_company_id WHERE company_id IS NULL;
  UPDATE public.work_orders SET company_id = new_company_id WHERE company_id IS NULL;
  UPDATE public.invoices SET company_id = new_company_id WHERE company_id IS NULL;
  UPDATE public.quotes SET company_id = new_company_id WHERE company_id IS NULL;
  UPDATE public.quote_templates SET company_id = new_company_id WHERE company_id IS NULL;
  UPDATE public.services SET company_id = new_company_id WHERE company_id IS NULL;
  UPDATE public.communication_logs SET company_id = new_company_id WHERE company_id IS NULL;
  UPDATE public.whatsapp_messages SET company_id = new_company_id WHERE company_id IS NULL;
  UPDATE public.whatsapp_config SET company_id = new_company_id WHERE company_id IS NULL;
  UPDATE public.whatsapp_automations SET company_id = new_company_id WHERE company_id IS NULL;
  UPDATE public.auto_message_settings SET company_id = new_company_id WHERE company_id IS NULL;
  UPDATE public.automation_send_log SET company_id = new_company_id WHERE company_id IS NULL;
  UPDATE public.todos SET company_id = new_company_id WHERE company_id IS NULL;
  UPDATE public.notifications SET company_id = new_company_id WHERE company_id IS NULL;
  UPDATE public.user_roles SET company_id = new_company_id WHERE company_id IS NULL;

  INSERT INTO public.user_roles (user_id, company_id, role) VALUES (admin_user_id, new_company_id, 'super_admin') ON CONFLICT DO NOTHING;
END $$;

-- ========== TRIGGER FUNCTIES UPDATEN ==========
CREATE OR REPLACE FUNCTION public.notify_on_work_order_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE admin_rec record;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  FOR admin_rec IN SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin' AND ur.company_id = NEW.company_id
  LOOP
    INSERT INTO public.notifications (user_id, company_id, title, body, link_page, link_params)
    VALUES (admin_rec.user_id, NEW.company_id, 'Werkbon status gewijzigd', COALESCE(NEW.work_order_number, 'Werkbon') || ' → ' || NEW.status, 'woDetail', jsonb_build_object('workOrderId', NEW.id::text));
  END LOOP;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_on_invoice_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE admin_rec record;
BEGIN
  IF OLD.status = 'betaald' OR NEW.status <> 'betaald' THEN RETURN NEW; END IF;
  FOR admin_rec IN SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin' AND ur.company_id = NEW.company_id
  LOOP
    INSERT INTO public.notifications (user_id, company_id, title, body, link_page, link_params)
    VALUES (admin_rec.user_id, NEW.company_id, 'Factuur betaald', COALESCE(NEW.invoice_number, 'Factuur') || ' — €' || NEW.total::text, 'invoices', '{}'::jsonb);
  END LOOP;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_on_whatsapp_incoming()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE admin_rec record; cust_name text;
BEGIN
  IF NEW.direction <> 'incoming' THEN RETURN NEW; END IF;
  SELECT name INTO cust_name FROM public.customers WHERE id = NEW.customer_id;
  FOR admin_rec IN SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin' AND ur.company_id = NEW.company_id
  LOOP
    INSERT INTO public.notifications (user_id, company_id, title, body, link_page, link_params)
    VALUES (admin_rec.user_id, NEW.company_id, 'Nieuw WhatsApp bericht', COALESCE(cust_name, 'Onbekend') || ': ' || LEFT(COALESCE(NEW.content, '[media]'), 100), 'whatsapp', '{}'::jsonb);
  END LOOP;
  RETURN NEW;
END;
$function$;

-- Nummergeneratoren scopen per company
CREATE OR REPLACE FUNCTION public.generate_work_order_number()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE current_year text; next_seq integer;
BEGIN
  current_year := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(work_order_number FROM 9) AS integer)), 0) + 1 INTO next_seq
  FROM public.work_orders WHERE work_order_number LIKE 'WB-' || current_year || '-%' AND company_id = NEW.company_id;
  NEW.work_order_number := 'WB-' || current_year || '-' || LPAD(next_seq::text, 4, '0');
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE current_year text; next_seq integer;
BEGIN
  current_year := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 8) AS integer)), 0) + 1 INTO next_seq
  FROM public.invoices WHERE invoice_number LIKE 'F-' || current_year || '-%' AND company_id = NEW.company_id;
  NEW.invoice_number := 'F-' || current_year || '-' || LPAD(next_seq::text, 3, '0');
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_quote_number()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE current_year text; next_seq integer;
BEGIN
  current_year := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(quote_number FROM 8) AS integer)), 0) + 1 INTO next_seq
  FROM public.quotes WHERE quote_number LIKE 'O-' || current_year || '-%' AND company_id = NEW.company_id;
  NEW.quote_number := 'O-' || current_year || '-' || LPAD(next_seq::text, 3, '0');
  RETURN NEW;
END;
$function$;
