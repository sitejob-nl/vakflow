
-- Add subscription management columns to companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS max_users integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS enabled_features text[] NOT NULL DEFAULT ARRAY['dashboard','planning','customers','workorders','invoices','quotes','email','whatsapp','communication','reminders'];

-- Allow super admins to update these fields (already covered by existing policies)
