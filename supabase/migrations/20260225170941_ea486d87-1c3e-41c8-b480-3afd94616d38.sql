
-- Auto-message settings table
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

CREATE POLICY "Users can view own auto_message_settings"
  ON public.auto_message_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own auto_message_settings"
  ON public.auto_message_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own auto_message_settings"
  ON public.auto_message_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own auto_message_settings"
  ON public.auto_message_settings FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_auto_message_settings_updated_at
  BEFORE UPDATE ON public.auto_message_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
