
SELECT cron.schedule(
  'apk-reminder-daily',
  '0 8 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://sigzpqwnavfxtvbyqvzj.supabase.co/functions/v1/apk-reminder-scan',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpZ3pwcXduYXZmeHR2YnlxdnpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMjM5MjUsImV4cCI6MjA4NzY5OTkyNX0.viejbTLs6i3GD6gETBNNoUTAOugkKQyY2EYVvOFa-3k"}'::jsonb,
        body:='{"source": "cron"}'::jsonb
    ) as request_id;
  $$
);
