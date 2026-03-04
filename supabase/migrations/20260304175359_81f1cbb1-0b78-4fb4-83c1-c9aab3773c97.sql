
-- Add missing FK indexes for scalability
CREATE INDEX IF NOT EXISTS idx_work_orders_assigned_to ON public.work_orders (assigned_to);
CREATE INDEX IF NOT EXISTS idx_user_outlook_tokens_company_id ON public.user_outlook_tokens (company_id);
CREATE INDEX IF NOT EXISTS idx_outlook_event_overrides_company_id ON public.outlook_event_overrides (company_id);
CREATE INDEX IF NOT EXISTS idx_snelstart_relaties_connection_id ON public.snelstart_relaties (connection_id);
CREATE INDEX IF NOT EXISTS idx_snelstart_artikelen_connection_id ON public.snelstart_artikelen (connection_id);
CREATE INDEX IF NOT EXISTS idx_snelstart_verkoopfacturen_connection_id ON public.snelstart_verkoopfacturen (connection_id);
CREATE INDEX IF NOT EXISTS idx_snelstart_verkooporders_connection_id ON public.snelstart_verkooporders (connection_id);
CREATE INDEX IF NOT EXISTS idx_snelstart_offertes_connection_id ON public.snelstart_offertes (connection_id);
