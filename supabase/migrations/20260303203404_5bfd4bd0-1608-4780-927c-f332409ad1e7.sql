-- ============================================================
-- 1. Foreign key indexes (~50 ontbrekende)
-- ============================================================

-- addresses
CREATE INDEX IF NOT EXISTS idx_addresses_company_id ON public.addresses (company_id);
CREATE INDEX IF NOT EXISTS idx_addresses_customer_id ON public.addresses (customer_id);

-- appointments
CREATE INDEX IF NOT EXISTS idx_appointments_address_id ON public.appointments (address_id);
CREATE INDEX IF NOT EXISTS idx_appointments_assigned_to ON public.appointments (assigned_to);
CREATE INDEX IF NOT EXISTS idx_appointments_company_id ON public.appointments (company_id);
CREATE INDEX IF NOT EXISTS idx_appointments_customer_id ON public.appointments (customer_id);
CREATE INDEX IF NOT EXISTS idx_appointments_service_id ON public.appointments (service_id);

-- asset_maintenance_logs
CREATE INDEX IF NOT EXISTS idx_asset_maint_logs_asset_id ON public.asset_maintenance_logs (asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_maint_logs_company_id ON public.asset_maintenance_logs (company_id);
CREATE INDEX IF NOT EXISTS idx_asset_maint_logs_performed_by ON public.asset_maintenance_logs (performed_by);
CREATE INDEX IF NOT EXISTS idx_asset_maint_logs_work_order_id ON public.asset_maintenance_logs (work_order_id);

-- assets
CREATE INDEX IF NOT EXISTS idx_assets_address_id ON public.assets (address_id);
CREATE INDEX IF NOT EXISTS idx_assets_company_id ON public.assets (company_id);
CREATE INDEX IF NOT EXISTS idx_assets_customer_id ON public.assets (customer_id);

-- auto_message_settings
CREATE INDEX IF NOT EXISTS idx_auto_msg_settings_company_id ON public.auto_message_settings (company_id);
CREATE INDEX IF NOT EXISTS idx_auto_msg_settings_template_id ON public.auto_message_settings (email_template_id);

-- automation_send_log
CREATE INDEX IF NOT EXISTS idx_automation_send_log_company_id ON public.automation_send_log (company_id);
CREATE INDEX IF NOT EXISTS idx_automation_send_log_customer_id ON public.automation_send_log (customer_id);

-- communication_logs
CREATE INDEX IF NOT EXISTS idx_comm_logs_company_id ON public.communication_logs (company_id);
CREATE INDEX IF NOT EXISTS idx_comm_logs_customer_id ON public.communication_logs (customer_id);
CREATE INDEX IF NOT EXISTS idx_comm_logs_work_order_id ON public.communication_logs (work_order_id);

-- customers
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON public.customers (company_id);
CREATE INDEX IF NOT EXISTS idx_customers_default_service_id ON public.customers (default_service_id);

-- email_templates
CREATE INDEX IF NOT EXISTS idx_email_templates_company_id ON public.email_templates (company_id);

-- invoices
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON public.invoices (company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON public.invoices (customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_work_order_id ON public.invoices (work_order_id);

-- meta_conversations
CREATE INDEX IF NOT EXISTS idx_meta_conversations_company_id ON public.meta_conversations (company_id);
CREATE INDEX IF NOT EXISTS idx_meta_conversations_customer_id ON public.meta_conversations (customer_id);

-- meta_leads
CREATE INDEX IF NOT EXISTS idx_meta_leads_company_id ON public.meta_leads (company_id);
CREATE INDEX IF NOT EXISTS idx_meta_leads_customer_id ON public.meta_leads (customer_id);

-- meta_page_posts
CREATE INDEX IF NOT EXISTS idx_meta_page_posts_company_id ON public.meta_page_posts (company_id);

-- notifications
CREATE INDEX IF NOT EXISTS idx_notifications_company_id ON public.notifications (company_id);

-- profiles
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles (company_id);

-- quote_templates
CREATE INDEX IF NOT EXISTS idx_quote_templates_company_id ON public.quote_templates (company_id);

-- quotes
CREATE INDEX IF NOT EXISTS idx_quotes_company_id ON public.quotes (company_id);
CREATE INDEX IF NOT EXISTS idx_quotes_customer_id ON public.quotes (customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_user_id ON public.quotes (user_id);

-- services
CREATE INDEX IF NOT EXISTS idx_services_company_id ON public.services (company_id);

-- todos
CREATE INDEX IF NOT EXISTS idx_todos_company_id ON public.todos (company_id);
CREATE INDEX IF NOT EXISTS idx_todos_customer_id ON public.todos (customer_id);

-- user_roles
CREATE INDEX IF NOT EXISTS idx_user_roles_company_id ON public.user_roles (company_id);

-- whatsapp_automations
CREATE INDEX IF NOT EXISTS idx_whatsapp_automations_company_id ON public.whatsapp_automations (company_id);

-- whatsapp_config
CREATE INDEX IF NOT EXISTS idx_whatsapp_config_company_id ON public.whatsapp_config (company_id);

-- whatsapp_messages
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_company_id ON public.whatsapp_messages (company_id);

-- work_order_materials
CREATE INDEX IF NOT EXISTS idx_work_order_materials_material_id ON public.work_order_materials (material_id);

-- work_orders
CREATE INDEX IF NOT EXISTS idx_work_orders_address_id ON public.work_orders (address_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_appointment_id ON public.work_orders (appointment_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_asset_id ON public.work_orders (asset_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_company_id ON public.work_orders (company_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_customer_id ON public.work_orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_service_id ON public.work_orders (service_id);

-- ============================================================
-- 2. phone_number_id kolom op whatsapp_config voor multi-tenant
-- ============================================================

ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS phone_number_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_config_phone_number_id
  ON public.whatsapp_config (phone_number_id)
  WHERE phone_number_id IS NOT NULL;

COMMENT ON COLUMN public.whatsapp_config.phone_number_id IS
  'WhatsApp Business phone_number_id uit Meta API — nodig voor multi-tenant webhook routing';

-- ============================================================
-- 3. Verwijder "always true" service role policies (security fix)
-- Service role key bypassed RLS sowieso, deze policies geven
-- onbedoeld ook anon/authenticated volledige toegang.
-- ============================================================

DROP POLICY IF EXISTS "Service role full access meta_config" ON public.meta_config;
DROP POLICY IF EXISTS "Service role full access meta_conversations" ON public.meta_conversations;
DROP POLICY IF EXISTS "Service role full access meta_leads" ON public.meta_leads;
DROP POLICY IF EXISTS "Service role full access meta_page_posts" ON public.meta_page_posts;
DROP POLICY IF EXISTS "Service role full access companies" ON public.companies;
DROP POLICY IF EXISTS "Service role full access whatsapp_config" ON public.whatsapp_config;