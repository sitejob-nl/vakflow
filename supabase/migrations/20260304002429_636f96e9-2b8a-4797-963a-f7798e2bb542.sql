-- Add unique constraint on company_id for whatsapp_config (one config per company)
ALTER TABLE public.whatsapp_config
  ADD CONSTRAINT whatsapp_config_company_id_key UNIQUE (company_id);