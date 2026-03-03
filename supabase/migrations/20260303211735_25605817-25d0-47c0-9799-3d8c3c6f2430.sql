
-- ============================================================
-- MEGA-MIGRATIE: RLS Hardening
-- 1. Alle policies → TO authenticated
-- 2. Alle function calls → (select ...) InitPlan wrappers
-- 3. Companies dubbele UPDATE → samengevoegd
-- ============================================================

-- ==================== addresses ====================
DROP POLICY IF EXISTS "Company users can delete addresses" ON public.addresses;
DROP POLICY IF EXISTS "Company users can insert addresses" ON public.addresses;
DROP POLICY IF EXISTS "Company users can view addresses" ON public.addresses;
DROP POLICY IF EXISTS "Company users can update addresses" ON public.addresses;

CREATE POLICY "Company users can view addresses" ON public.addresses FOR SELECT TO authenticated
  USING (company_id = (select public.get_my_company_id()) OR (select public.is_super_admin()));
CREATE POLICY "Company users can insert addresses" ON public.addresses FOR INSERT TO authenticated
  WITH CHECK (company_id = (select public.get_my_company_id()));
CREATE POLICY "Company users can update addresses" ON public.addresses FOR UPDATE TO authenticated
  USING (company_id = (select public.get_my_company_id()));
CREATE POLICY "Company users can delete addresses" ON public.addresses FOR DELETE TO authenticated
  USING (company_id = (select public.get_my_company_id()));

-- ==================== appointments ====================
DROP POLICY IF EXISTS "Company users can delete appointments" ON public.appointments;
DROP POLICY IF EXISTS "Company users can insert appointments" ON public.appointments;
DROP POLICY IF EXISTS "Company users can view appointments" ON public.appointments;
DROP POLICY IF EXISTS "Company users can update appointments" ON public.appointments;

CREATE POLICY "Company users can view appointments" ON public.appointments FOR SELECT TO authenticated
  USING (company_id = (select public.get_my_company_id()) OR (select public.is_super_admin()));
CREATE POLICY "Company users can insert appointments" ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (company_id = (select public.get_my_company_id()));
CREATE POLICY "Company users can update appointments" ON public.appointments FOR UPDATE TO authenticated
  USING (company_id = (select public.get_my_company_id()));
CREATE POLICY "Company users can delete appointments" ON public.appointments FOR DELETE TO authenticated
  USING (company_id = (select public.get_my_company_id()));

-- ==================== asset_maintenance_logs ====================
DROP POLICY IF EXISTS "Company users can delete maintenance logs" ON public.asset_maintenance_logs;
DROP POLICY IF EXISTS "Company users can insert maintenance logs" ON public.asset_maintenance_logs;
DROP POLICY IF EXISTS "Company users can view maintenance logs" ON public.asset_maintenance_logs;
DROP POLICY IF EXISTS "Company users can update maintenance logs" ON public.asset_maintenance_logs;

CREATE POLICY "Company users can view maintenance logs" ON public.asset_maintenance_logs FOR SELECT TO authenticated
  USING (company_id = (select public.get_my_company_id()) OR (select public.is_super_admin()));
CREATE POLICY "Company users can insert maintenance logs" ON public.asset_maintenance_logs FOR INSERT TO authenticated
  WITH CHECK (company_id = (select public.get_my_company_id()));
CREATE POLICY "Company users can update maintenance logs" ON public.asset_maintenance_logs FOR UPDATE TO authenticated
  USING (company_id = (select public.get_my_company_id()));
CREATE POLICY "Company users can delete maintenance logs" ON public.asset_maintenance_logs FOR DELETE TO authenticated
  USING (company_id = (select public.get_my_company_id()));

-- ==================== assets ====================
DROP POLICY IF EXISTS "Company users can delete assets" ON public.assets;
DROP POLICY IF EXISTS "Company users can insert assets" ON public.assets;
DROP POLICY IF EXISTS "Company users can view assets" ON public.assets;
DROP POLICY IF EXISTS "Company users can update assets" ON public.assets;

CREATE POLICY "Company users can view assets" ON public.assets FOR SELECT TO authenticated
  USING (company_id = (select public.get_my_company_id()) OR (select public.is_super_admin()));
CREATE POLICY "Company users can insert assets" ON public.assets FOR INSERT TO authenticated
  WITH CHECK (company_id = (select public.get_my_company_id()));
CREATE POLICY "Company users can update assets" ON public.assets FOR UPDATE TO authenticated
  USING (company_id = (select public.get_my_company_id()));
CREATE POLICY "Company users can delete assets" ON public.assets FOR DELETE TO authenticated
  USING (company_id = (select public.get_my_company_id()));

-- ==================== auto_message_settings ====================
DROP POLICY IF EXISTS "Company users can delete auto_message_settings" ON public.auto_message_settings;
DROP POLICY IF EXISTS "Company users can insert auto_message_settings" ON public.auto_message_settings;
DROP POLICY IF EXISTS "Company users can view auto_message_settings" ON public.auto_message_settings;
DROP POLICY IF EXISTS "Company users can update auto_message_settings" ON public.auto_message_settings;

CREATE POLICY "Company users can view auto_message_settings" ON public.auto_message_settings FOR SELECT TO authenticated
  USING (company_id = (select public.get_my_company_id()) OR (select public.is_super_admin()));
CREATE POLICY "Company users can insert auto_message_settings" ON public.auto_message_settings FOR INSERT TO authenticated
  WITH CHECK (company_id = (select public.get_my_company_id()));
CREATE POLICY "Company users can update auto_message_settings" ON public.auto_message_settings FOR UPDATE TO authenticated
  USING (company_id = (select public.get_my_company_id()));
CREATE POLICY "Company users can delete auto_message_settings" ON public.auto_message_settings FOR DELETE TO authenticated
  USING (company_id = (select public.get_my_company_id()));

-- ==================== automation_send_log ====================
DROP POLICY IF EXISTS "Company users can insert send logs" ON public.automation_send_log;
DROP POLICY IF EXISTS "Company users can view send logs" ON public.automation_send_log;

CREATE POLICY "Company users can view send logs" ON public.automation_send_log FOR SELECT TO authenticated
  USING (company_id = (select public.get_my_company_id()) OR (select public.is_super_admin()));
CREATE POLICY "Company users can insert send logs" ON public.automation_send_log FOR INSERT TO authenticated
  WITH CHECK (company_id = (select public.get_my_company_id()));

-- ==================== communication_logs ====================
DROP POLICY IF EXISTS "Company users can delete communication_logs" ON public.communication_logs;
DROP POLICY IF EXISTS "Company users can insert communication_logs" ON public.communication_logs;
DROP POLICY IF EXISTS "Company users can view communication_logs" ON public.communication_logs;
DROP POLICY IF EXISTS "Company users can update communication_logs" ON public.communication_logs;

CREATE POLICY "Company users can view communication_logs" ON public.communication_logs FOR SELECT TO authenticated
  USING (company_id = (select public.get_my_company_id()) OR (select public.is_super_admin()));
CREATE POLICY "Company users can insert communication_logs" ON public.communication_logs FOR INSERT TO authenticated
  WITH CHECK (company_id = (select public.get_my_company_id()));
CREATE POLICY "Company users can update communication_logs" ON public.communication_logs FOR UPDATE TO authenticated
  USING (company_id = (select public.get_my_company_id()));
CREATE POLICY "Company users can delete communication_logs" ON public.communication_logs FOR DELETE TO authenticated
  USING (company_id = (select public.get_my_company_id()));

-- ==================== companies (MERGE UPDATE policies) ====================
DROP POLICY IF EXISTS "Company admins and super_admins can view companies" ON public.companies;
DROP POLICY IF EXISTS "Admins can update own company" ON public.companies;
DROP POLICY IF EXISTS "Super admins can update companies" ON public.companies;
DROP POLICY IF EXISTS "Super admins can manage companies" ON public.companies;
DROP POLICY IF EXISTS "Super admins can delete companies" ON public.companies;

CREATE POLICY "Company admins and super_admins can view companies" ON public.companies FOR SELECT TO authenticated
  USING ((id = (select public.get_my_company_id()) AND public.has_role((select auth.uid()), 'admin'::app_role)) OR (select public.is_super_admin()));
-- MERGED: admin update + super_admin update → one policy
CREATE POLICY "Admins and super admins can update companies" ON public.companies FOR UPDATE TO authenticated
  USING ((id = (select public.get_my_company_id()) AND public.has_role((select auth.uid()), 'admin'::app_role)) OR (select public.is_super_admin()))
  WITH CHECK ((id = (select public.get_my_company_id()) AND public.has_role((select auth.uid()), 'admin'::app_role)) OR (select public.is_super_admin()));
CREATE POLICY "Super admins can manage companies" ON public.companies FOR INSERT TO authenticated
  WITH CHECK ((select public.is_super_admin()));
CREATE POLICY "Super admins can delete companies" ON public.companies FOR DELETE TO authenticated
  USING ((select public.is_super_admin()));

-- ==================== customers ====================
DROP POLICY IF EXISTS "Company users can delete customers" ON public.customers;
DROP POLICY IF EXISTS "Company users can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Company users can view customers" ON public.customers;
DROP POLICY IF EXISTS "Company users can update customers" ON public.customers;

CREATE POLICY "Company users can view customers" ON public.customers FOR SELECT TO authenticated
  USING (company_id = (select public.get_my_company_id()) OR (select public.is_super_admin()));
CREATE POLICY "Company users can insert customers" ON public.customers FOR INSERT TO authenticated
  WITH CHECK (company_id = (select public.get_my_company_id()));
CREATE POLICY "Company users can update customers" ON public.customers FOR UPDATE TO authenticated
  USING (company_id = (select public.get_my_company_id()));
CREATE POLICY "Company users can delete customers" ON public.customers FOR DELETE TO authenticated
  USING (company_id = (select public.get_my_company_id()));

-- ==================== email_templates ====================
DROP POLICY IF EXISTS "Company users can delete email_templates" ON public.email_templates;
DROP POLICY IF EXISTS "Company users can insert email_templates" ON public.email_templates;
DROP POLICY IF EXISTS "Company users can view email_templates" ON public.email_templates;
DROP POLICY IF EXISTS "Company users can update email_templates" ON public.email_templates;

CREATE POLICY "Company users can view email_templates" ON public.email_templates FOR SELECT TO authenticated
  USING (company_id = (select public.get_my_company_id()) OR (select public.is_super_admin()));
CREATE POLICY "Company users can insert email_templates" ON public.email_templates FOR INSERT TO authenticated
  WITH CHECK (company_id = (select public.get_my_company_id()));
CREATE POLICY "Company users can update email_templates" ON public.email_templates FOR UPDATE TO authenticated
  USING (company_id = (select public.get_my_company_id()));
CREATE POLICY "Company users can delete email_templates" ON public.email_templates FOR DELETE TO authenticated
  USING (company_id = (select public.get_my_company_id()));

-- ==================== invoices ====================
DROP POLICY IF EXISTS "Company admins can delete invoices" ON public.invoices;
DROP POLICY IF EXISTS "Company admins can insert invoices" ON public.invoices;
DROP POLICY IF EXISTS "Company admins can view invoices" ON public.invoices;
DROP POLICY IF EXISTS "Company admins can update invoices" ON public.invoices;

CREATE POLICY "Company admins can view invoices" ON public.invoices FOR SELECT TO authenticated
  USING (company_id = (select public.get_my_company_id()) OR (select public.is_super_admin()));
CREATE POLICY "Company admins can insert invoices" ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (company_id = (select public.get_my_company_id()) AND public.has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Company admins can update invoices" ON public.invoices FOR UPDATE TO authenticated
  USING (company_id = (select public.get_my_company_id()) AND public.has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Company admins can delete invoices" ON public.invoices FOR DELETE TO authenticated
  USING (company_id = (select public.get_my_company_id()) AND public.has_role((select auth.uid()), 'admin'::app_role));

-- ==================== materials ====================
DROP POLICY IF EXISTS "Company users can delete materials" ON public.materials;
DROP POLICY IF EXISTS "Company users can insert materials" ON public.materials;
DROP POLICY IF EXISTS "Company users can view materials" ON public.materials;
DROP POLICY IF EXISTS "Company users can update materials" ON public.materials;

CREATE POLICY "Company users can view materials" ON public.materials FOR SELECT TO authenticated
  USING (company_id = (select public.get_my_company_id()) OR (select public.is_super_admin()));
CREATE POLICY "Company users can insert materials" ON public.materials FOR INSERT TO authenticated
  WITH CHECK (company_id = (select public.get_my_company_id()));
CREATE POLICY "Company users can update materials" ON public.materials FOR UPDATE TO authenticated
  USING (company_id = (select public.get_my_company_id()));
CREATE POLICY "Company users can delete materials" ON public.materials FOR DELETE TO authenticated
  USING (company_id = (select public.get_my_company_id()));

-- ==================== meta_config ====================
DROP POLICY IF EXISTS "Company admins can delete meta_config" ON public.meta_config;
DROP POLICY IF EXISTS "Company admins can insert meta_config" ON public.meta_config;
DROP POLICY IF EXISTS "Company admins can view meta_config" ON public.meta_config;
DROP POLICY IF EXISTS "Company admins can update meta_config" ON public.meta_config;

CREATE POLICY "Company admins can view meta_config" ON public.meta_config FOR SELECT TO authenticated
  USING (company_id = (select public.get_my_company_id()) OR (select public.is_super_admin()));
CREATE POLICY "Company admins can insert meta_config" ON public.meta_config FOR INSERT TO authenticated
  WITH CHECK (company_id = (select public.get_my_company_id()) AND public.has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Company admins can update meta_config" ON public.meta_config FOR UPDATE TO authenticated
  USING (company_id = (select public.get_my_company_id()) AND public.has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Company admins can delete meta_config" ON public.meta_config FOR DELETE TO authenticated
  USING (company_id = (select public.get_my_company_id()) AND public.has_role((select auth.uid()), 'admin'::app_role));

-- ==================== meta_conversations ====================
DROP POLICY IF EXISTS "Company users can insert meta_conversations" ON public.meta_conversations;
DROP POLICY IF EXISTS "Company users can view meta_conversations" ON public.meta_conversations;
DROP POLICY IF EXISTS "Company users can update meta_conversations" ON public.meta_conversations;

CREATE POLICY "Company users can view meta_conversations" ON public.meta_conversations FOR SELECT TO authenticated
  USING (company_id = (select public.get_my_company_id()) OR (select public.is_super_admin()));
CREATE POLICY "Company users can insert meta_conversations" ON public.meta_conversations FOR INSERT TO authenticated
  WITH CHECK (company_id = (select public.get_my_company_id()));
CREATE POLICY "Company users can update meta_conversations" ON public.meta_conversations FOR UPDATE TO authenticated
  USING (company_id = (select public.get_my_company_id()));

-- ==================== meta_leads ====================
DROP POLICY IF EXISTS "Company users can delete meta_leads" ON public.meta_leads;
DROP POLICY IF EXISTS "Company users can insert meta_leads" ON public.meta_leads;
DROP POLICY IF EXISTS "Company users can view meta_leads" ON public.meta_leads;
DROP POLICY IF EXISTS "Company users can update meta_leads" ON public.meta_leads;

CREATE POLICY "Company users can view meta_leads" ON public.meta_leads FOR SELECT TO authenticated
  USING (company_id = (select public.get_my_company_id()) OR (select public.is_super_admin()));
CREATE POLICY "Company users can insert meta_leads" ON public.meta_leads FOR INSERT TO authenticated
  WITH CHECK (company_id = (select public.get_my_company_id()));
CREATE POLICY "Company users can update meta_leads" ON public.meta_leads FOR UPDATE TO authenticated
  USING (company_id = (select public.get_my_company_id()));
CREATE POLICY "Company users can delete meta_leads" ON public.meta_leads FOR DELETE TO authenticated
  USING (company_id = (select public.get_my_company_id()));

-- ==================== meta_page_posts ====================
DROP POLICY IF EXISTS "Company users can delete meta_page_posts" ON public.meta_page_posts;
DROP POLICY IF EXISTS "Company users can insert meta_page_posts" ON public.meta_page_posts;
DROP POLICY IF EXISTS "Company users can view meta_page_posts" ON public.meta_page_posts;
DROP POLICY IF EXISTS "Company users can update meta_page_posts" ON public.meta_page_posts;

CREATE POLICY "Company users can view meta_page_posts" ON public.meta_page_posts FOR SELECT TO authenticated
  USING (company_id = (select public.get_my_company_id()) OR (select public.is_super_admin()));
CREATE POLICY "Company users can insert meta_page_posts" ON public.meta_page_posts FOR INSERT TO authenticated
  WITH CHECK (company_id = (select public.get_my_company_id()));
CREATE POLICY "Company users can update meta_page_posts" ON public.meta_page_posts FOR UPDATE TO authenticated
  USING (company_id = (select public.get_my_company_id()));
CREATE POLICY "Company users can delete meta_page_posts" ON public.meta_page_posts FOR DELETE TO authenticated
  USING (company_id = (select public.get_my_company_id()));

-- ==================== notifications ====================
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Company users can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Company users can view notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;

CREATE POLICY "Company users can view notifications" ON public.notifications FOR SELECT TO authenticated
  USING (company_id = (select public.get_my_company_id()) OR user_id = (select auth.uid()) OR (select public.is_super_admin()));
CREATE POLICY "Company users can insert notifications" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (company_id = (select public.get_my_company_id()) OR (select public.is_super_admin()));
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()));
CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- ==================== profiles ====================
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view company profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can view company profiles" ON public.profiles FOR SELECT TO authenticated
  USING (company_id = (select public.get_my_company_id()) OR (select public.is_super_admin()) OR id = (select auth.uid()));
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = (select auth.uid()));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = (select auth.uid()));

-- ==================== quote_templates ====================
DROP POLICY IF EXISTS "Company users can delete templates" ON public.quote_templates;
DROP POLICY IF EXISTS "Company users can insert templates" ON public.quote_templates;
DROP POLICY IF EXISTS "Company users can view templates" ON public.quote_templates;
DROP POLICY IF EXISTS "Company users can update templates" ON public.quote_templates;

CREATE POLICY "Company users can view templates" ON public.quote_templates FOR SELECT TO authenticated
  USING (company_id = (select public.get_my_company_id()) OR (select public.is_super_admin()));
CREATE POLICY "Company users can insert templates" ON public.quote_templates FOR INSERT TO authenticated
  WITH CHECK (company_id = (select public.get_my_company_id()));
CREATE POLICY "Company users can update templates" ON public.quote_templates FOR UPDATE TO authenticated
  USING (company_id = (select public.get_my_company_id()));
CREATE POLICY "Company users can delete templates" ON public.quote_templates FOR DELETE TO authenticated
  USING (company_id = (select public.get_my_company_id()));

-- ==================== quotes ====================
DROP POLICY IF EXISTS "Company users can delete quotes" ON public.quotes;
DROP POLICY IF EXISTS "Company users can insert quotes" ON public.quotes;
DROP POLICY IF EXISTS "Company users can view quotes" ON public.quotes;
DROP POLICY IF EXISTS "Company users can update quotes" ON public.quotes;

CREATE POLICY "Company users can view quotes" ON public.quotes FOR SELECT TO authenticated
  USING (company_id = (select public.get_my_company_id()) OR (select public.is_super_admin()));
CREATE POLICY "Company users can insert quotes" ON public.quotes FOR INSERT TO authenticated
  WITH CHECK (company_id = (select public.get_my_company_id()));
CREATE POLICY "Company users can update quotes" ON public.quotes FOR UPDATE TO authenticated
  USING (company_id = (select public.get_my_company_id()));
CREATE POLICY "Company users can delete quotes" ON public.quotes FOR DELETE TO authenticated
  USING (company_id = (select public.get_my_company_id()));

-- ==================== services ====================
DROP POLICY IF EXISTS "Company admins can delete services" ON public.services;
DROP POLICY IF EXISTS "Company admins can insert services" ON public.services;
DROP POLICY IF EXISTS "Company users can view services" ON public.services;
DROP POLICY IF EXISTS "Company admins can update services" ON public.services;

CREATE POLICY "Company users can view services" ON public.services FOR SELECT TO authenticated
  USING (company_id = (select public.get_my_company_id()) OR (select public.is_super_admin()));
CREATE POLICY "Company admins can insert services" ON public.services FOR INSERT TO authenticated
  WITH CHECK (company_id = (select public.get_my_company_id()) AND public.has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Company admins can update services" ON public.services FOR UPDATE TO authenticated
  USING (company_id = (select public.get_my_company_id()) AND public.has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Company admins can delete services" ON public.services FOR DELETE TO authenticated
  USING (company_id = (select public.get_my_company_id()) AND public.has_role((select auth.uid()), 'admin'::app_role));

-- ==================== time_entries ====================
DROP POLICY IF EXISTS "Company users can delete time_entries" ON public.time_entries;
DROP POLICY IF EXISTS "Company users can insert time_entries" ON public.time_entries;
DROP POLICY IF EXISTS "Company users can view time_entries" ON public.time_entries;
DROP POLICY IF EXISTS "Company users can update time_entries" ON public.time_entries;

CREATE POLICY "Company users can view time_entries" ON public.time_entries FOR SELECT TO authenticated
  USING (company_id = (select public.get_my_company_id()) OR (select public.is_super_admin()));
CREATE POLICY "Company users can insert time_entries" ON public.time_entries FOR INSERT TO authenticated
  WITH CHECK (company_id = (select public.get_my_company_id()));
CREATE POLICY "Company users can update time_entries" ON public.time_entries FOR UPDATE TO authenticated
  USING (company_id = (select public.get_my_company_id()));
CREATE POLICY "Company users can delete time_entries" ON public.time_entries FOR DELETE TO authenticated
  USING (company_id = (select public.get_my_company_id()));

-- ==================== todos ====================
DROP POLICY IF EXISTS "Company users can delete todos" ON public.todos;
DROP POLICY IF EXISTS "Company users can insert todos" ON public.todos;
DROP POLICY IF EXISTS "Company users can view todos" ON public.todos;
DROP POLICY IF EXISTS "Company users can update todos" ON public.todos;

CREATE POLICY "Company users can view todos" ON public.todos FOR SELECT TO authenticated
  USING (company_id = (select public.get_my_company_id()) OR (select public.is_super_admin()));
CREATE POLICY "Company users can insert todos" ON public.todos FOR INSERT TO authenticated
  WITH CHECK (company_id = (select public.get_my_company_id()));
CREATE POLICY "Company users can update todos" ON public.todos FOR UPDATE TO authenticated
  USING (company_id = (select public.get_my_company_id()));
CREATE POLICY "Company users can delete todos" ON public.todos FOR DELETE TO authenticated
  USING (company_id = (select public.get_my_company_id()));

-- ==================== usage_events ====================
DROP POLICY IF EXISTS "Super admins can view usage_events" ON public.usage_events;

CREATE POLICY "Super admins can view usage_events" ON public.usage_events FOR SELECT TO authenticated
  USING ((select public.is_super_admin()));

-- ==================== user_roles ====================
DROP POLICY IF EXISTS "Company admins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Company admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Company users can view roles" ON public.user_roles;
DROP POLICY IF EXISTS "Company admins can update roles" ON public.user_roles;

CREATE POLICY "Company users can view roles" ON public.user_roles FOR SELECT TO authenticated
  USING (company_id = (select public.get_my_company_id()) OR (select public.is_super_admin()) OR user_id = (select auth.uid()));
CREATE POLICY "Company admins can insert roles" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (company_id = (select public.get_my_company_id()) AND public.has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Company admins can update roles" ON public.user_roles FOR UPDATE TO authenticated
  USING (company_id = (select public.get_my_company_id()) AND public.has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Company admins can delete roles" ON public.user_roles FOR DELETE TO authenticated
  USING (company_id = (select public.get_my_company_id()) AND public.has_role((select auth.uid()), 'admin'::app_role));

-- ==================== whatsapp_automations ====================
DROP POLICY IF EXISTS "Company users can delete automations" ON public.whatsapp_automations;
DROP POLICY IF EXISTS "Company users can insert automations" ON public.whatsapp_automations;
DROP POLICY IF EXISTS "Company users can view automations" ON public.whatsapp_automations;
DROP POLICY IF EXISTS "Company users can update automations" ON public.whatsapp_automations;

CREATE POLICY "Company users can view automations" ON public.whatsapp_automations FOR SELECT TO authenticated
  USING (company_id = (select public.get_my_company_id()) OR (select public.is_super_admin()));
CREATE POLICY "Company users can insert automations" ON public.whatsapp_automations FOR INSERT TO authenticated
  WITH CHECK (company_id = (select public.get_my_company_id()));
CREATE POLICY "Company users can update automations" ON public.whatsapp_automations FOR UPDATE TO authenticated
  USING (company_id = (select public.get_my_company_id()));
CREATE POLICY "Company users can delete automations" ON public.whatsapp_automations FOR DELETE TO authenticated
  USING (company_id = (select public.get_my_company_id()));

-- ==================== whatsapp_config ====================
DROP POLICY IF EXISTS "Company admins can delete whatsapp_config" ON public.whatsapp_config;
DROP POLICY IF EXISTS "Company admins can insert whatsapp_config" ON public.whatsapp_config;
DROP POLICY IF EXISTS "Company users can view whatsapp_config" ON public.whatsapp_config;
DROP POLICY IF EXISTS "Company admins can update whatsapp_config" ON public.whatsapp_config;

CREATE POLICY "Company users can view whatsapp_config" ON public.whatsapp_config FOR SELECT TO authenticated
  USING (company_id = (select public.get_my_company_id()) OR (select public.is_super_admin()));
CREATE POLICY "Company admins can insert whatsapp_config" ON public.whatsapp_config FOR INSERT TO authenticated
  WITH CHECK (company_id = (select public.get_my_company_id()));
CREATE POLICY "Company admins can update whatsapp_config" ON public.whatsapp_config FOR UPDATE TO authenticated
  USING (company_id = (select public.get_my_company_id()));
CREATE POLICY "Company admins can delete whatsapp_config" ON public.whatsapp_config FOR DELETE TO authenticated
  USING (company_id = (select public.get_my_company_id()));

-- ==================== whatsapp_messages ====================
DROP POLICY IF EXISTS "Company users can insert whatsapp_messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Company users can view whatsapp_messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Company users can update whatsapp_messages" ON public.whatsapp_messages;

CREATE POLICY "Company users can view whatsapp_messages" ON public.whatsapp_messages FOR SELECT TO authenticated
  USING (company_id = (select public.get_my_company_id()) OR (select public.is_super_admin()));
CREATE POLICY "Company users can insert whatsapp_messages" ON public.whatsapp_messages FOR INSERT TO authenticated
  WITH CHECK (company_id = (select public.get_my_company_id()));
CREATE POLICY "Company users can update whatsapp_messages" ON public.whatsapp_messages FOR UPDATE TO authenticated
  USING (company_id = (select public.get_my_company_id()));

-- ==================== work_order_materials ====================
DROP POLICY IF EXISTS "Company users can delete work_order_materials" ON public.work_order_materials;
DROP POLICY IF EXISTS "Company users can insert work_order_materials" ON public.work_order_materials;
DROP POLICY IF EXISTS "Company users can view work_order_materials" ON public.work_order_materials;
DROP POLICY IF EXISTS "Company users can update work_order_materials" ON public.work_order_materials;

CREATE POLICY "Company users can view work_order_materials" ON public.work_order_materials FOR SELECT TO authenticated
  USING (company_id = (select public.get_my_company_id()) OR (select public.is_super_admin()));
CREATE POLICY "Company users can insert work_order_materials" ON public.work_order_materials FOR INSERT TO authenticated
  WITH CHECK (company_id = (select public.get_my_company_id()));
CREATE POLICY "Company users can update work_order_materials" ON public.work_order_materials FOR UPDATE TO authenticated
  USING (company_id = (select public.get_my_company_id()));
CREATE POLICY "Company users can delete work_order_materials" ON public.work_order_materials FOR DELETE TO authenticated
  USING (company_id = (select public.get_my_company_id()));

-- ==================== work_orders ====================
DROP POLICY IF EXISTS "Company users can delete work_orders" ON public.work_orders;
DROP POLICY IF EXISTS "Company users can insert work_orders" ON public.work_orders;
DROP POLICY IF EXISTS "Company users can view work_orders" ON public.work_orders;
DROP POLICY IF EXISTS "Company users can update work_orders" ON public.work_orders;

CREATE POLICY "Company users can view work_orders" ON public.work_orders FOR SELECT TO authenticated
  USING (company_id = (select public.get_my_company_id()) OR (select public.is_super_admin()));
CREATE POLICY "Company users can insert work_orders" ON public.work_orders FOR INSERT TO authenticated
  WITH CHECK (company_id = (select public.get_my_company_id()));
CREATE POLICY "Company users can update work_orders" ON public.work_orders FOR UPDATE TO authenticated
  USING (company_id = (select public.get_my_company_id()));
CREATE POLICY "Company users can delete work_orders" ON public.work_orders FOR DELETE TO authenticated
  USING (company_id = (select public.get_my_company_id()));
