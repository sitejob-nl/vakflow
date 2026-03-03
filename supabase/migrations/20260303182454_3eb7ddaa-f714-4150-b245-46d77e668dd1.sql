
-- Meta config table (credentials per company)
CREATE TABLE public.meta_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  app_id text,
  app_secret text,
  page_access_token text,
  page_id text,
  instagram_account_id text,
  webhook_verify_token text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

ALTER TABLE public.meta_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company admins can view meta_config" ON public.meta_config FOR SELECT USING ((company_id = get_my_company_id()) OR is_super_admin());
CREATE POLICY "Company admins can insert meta_config" ON public.meta_config FOR INSERT WITH CHECK (company_id = get_my_company_id() AND has_role(auth.uid(), 'admin'));
CREATE POLICY "Company admins can update meta_config" ON public.meta_config FOR UPDATE USING (company_id = get_my_company_id() AND has_role(auth.uid(), 'admin'));
CREATE POLICY "Company admins can delete meta_config" ON public.meta_config FOR DELETE USING (company_id = get_my_company_id() AND has_role(auth.uid(), 'admin'));
CREATE POLICY "Service role full access meta_config" ON public.meta_config FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER update_meta_config_updated_at BEFORE UPDATE ON public.meta_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Meta leads table
CREATE TABLE public.meta_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  lead_id text NOT NULL,
  form_id text,
  form_name text,
  customer_data jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'nieuw',
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.meta_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view meta_leads" ON public.meta_leads FOR SELECT USING ((company_id = get_my_company_id()) OR is_super_admin());
CREATE POLICY "Company users can insert meta_leads" ON public.meta_leads FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Company users can update meta_leads" ON public.meta_leads FOR UPDATE USING (company_id = get_my_company_id());
CREATE POLICY "Company users can delete meta_leads" ON public.meta_leads FOR DELETE USING (company_id = get_my_company_id());
CREATE POLICY "Service role full access meta_leads" ON public.meta_leads FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER update_meta_leads_updated_at BEFORE UPDATE ON public.meta_leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Meta conversations table (Messenger + Instagram DMs)
CREATE TABLE public.meta_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  platform text NOT NULL DEFAULT 'messenger',
  sender_name text,
  sender_id text,
  content text,
  direction text NOT NULL DEFAULT 'incoming',
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  message_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.meta_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view meta_conversations" ON public.meta_conversations FOR SELECT USING ((company_id = get_my_company_id()) OR is_super_admin());
CREATE POLICY "Company users can insert meta_conversations" ON public.meta_conversations FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Company users can update meta_conversations" ON public.meta_conversations FOR UPDATE USING (company_id = get_my_company_id());
CREATE POLICY "Service role full access meta_conversations" ON public.meta_conversations FOR ALL USING (true) WITH CHECK (true);

-- Meta page posts table
CREATE TABLE public.meta_page_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  post_id text NOT NULL,
  message text,
  created_time timestamptz,
  likes integer DEFAULT 0,
  comments integer DEFAULT 0,
  shares integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.meta_page_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view meta_page_posts" ON public.meta_page_posts FOR SELECT USING ((company_id = get_my_company_id()) OR is_super_admin());
CREATE POLICY "Company users can insert meta_page_posts" ON public.meta_page_posts FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Company users can update meta_page_posts" ON public.meta_page_posts FOR UPDATE USING (company_id = get_my_company_id());
CREATE POLICY "Company users can delete meta_page_posts" ON public.meta_page_posts FOR DELETE USING (company_id = get_my_company_id());
CREATE POLICY "Service role full access meta_page_posts" ON public.meta_page_posts FOR ALL USING (true) WITH CHECK (true);

-- Add 'marketing' to enabled_features default
ALTER TABLE public.companies ALTER COLUMN enabled_features SET DEFAULT ARRAY['dashboard','planning','customers','workorders','invoices','quotes','reports','email','whatsapp','communication','reminders','assets','marketing'];
