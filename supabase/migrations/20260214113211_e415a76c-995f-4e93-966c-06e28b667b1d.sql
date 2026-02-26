SELECT cron.schedule(
  'daily-eboekhouden-sync',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://hhozgcmkickfdesnlpgs.supabase.co/functions/v1/sync-invoice-eboekhouden',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhob3pnY21raWNrZmRlc25scGdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NjUzODIsImV4cCI6MjA4NjM0MTM4Mn0.XcPlki86gMA0mG6L8bQ6jUTs9v-uQ56ADa2-kZyXESE"}'::jsonb,
    body := '{"action": "auto-sync"}'::jsonb
  ) AS request_id;
  $$
);