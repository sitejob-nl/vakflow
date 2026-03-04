CREATE INDEX IF NOT EXISTS idx_usage_events_company_type_created
  ON public.usage_events (company_id, event_type, created_at DESC);