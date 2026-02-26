ALTER TABLE public.profiles
  ADD COLUMN smtp_host text DEFAULT 'smtp.transip.email',
  ADD COLUMN smtp_port integer DEFAULT 465;