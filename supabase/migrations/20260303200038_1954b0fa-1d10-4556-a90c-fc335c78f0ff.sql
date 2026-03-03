
-- Create email_templates table
CREATE TABLE public.email_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject text,
  html_body text NOT NULL DEFAULT '',
  variables jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Company users can view email_templates"
  ON public.email_templates FOR SELECT
  USING (company_id = get_my_company_id() OR is_super_admin());

CREATE POLICY "Company users can insert email_templates"
  ON public.email_templates FOR INSERT
  WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "Company users can update email_templates"
  ON public.email_templates FOR UPDATE
  USING (company_id = get_my_company_id());

CREATE POLICY "Company users can delete email_templates"
  ON public.email_templates FOR DELETE
  USING (company_id = get_my_company_id());

-- Updated_at trigger
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add email_template_id to auto_message_settings
ALTER TABLE public.auto_message_settings
  ADD COLUMN email_template_id uuid REFERENCES public.email_templates(id) ON DELETE SET NULL;
