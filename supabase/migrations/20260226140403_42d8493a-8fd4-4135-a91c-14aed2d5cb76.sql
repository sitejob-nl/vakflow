
-- Create whatsapp_automations table
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

-- Create automation_send_log table (anti-spam)
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
