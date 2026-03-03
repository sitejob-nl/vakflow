

## Plan: pg_cron job aanmaken voor reminder-scan

Het `CRON_SECRET` secret staat al ingesteld. Nu moet er een `pg_cron` job aangemaakt worden die de `reminder-scan` function periodiek aanroept met de `X-Cron-Secret` header.

### Wat er gebeurt

Een SQL statement via `cron.schedule()` dat dagelijks (bijv. 08:00 UTC) een HTTP POST doet naar `reminder-scan` met:
- `Authorization: Bearer <ANON_KEY>` (nodig om door de gateway te komen)
- `X-Cron-Secret: <CRON_SECRET>` (wordt in de function gevalideerd)

### Technische details

Dit wordt uitgevoerd als directe SQL query (niet als migratie, want het bevat project-specifieke waarden):

```sql
select cron.schedule(
  'reminder-scan-daily',
  '0 8 * * *',  -- elke dag om 08:00 UTC
  $$
  select net.http_post(
    url := '<SUPABASE_URL>/functions/v1/reminder-scan',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <ANON_KEY>","X-Cron-Secret":"<CRON_SECRET_VALUE>"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);
```

### Belangrijk

Ik heb de **waarde** van `CRON_SECRET` nodig om deze in de cron job header te plaatsen. Secrets zijn encrypted en ik kan ze niet uitlezen. Je moet me de waarde van `CRON_SECRET` geven zodat ik de cron job kan aanmaken, of je kunt de SQL zelf uitvoeren in de Supabase SQL Editor met de juiste waarde ingevuld.

Hetzelfde geldt voor de `SUPABASE_ANON_KEY` — die staat als secret maar de waarde is nodig in de SQL.

### Alternatief

Als je liever niet de secret waarden deelt: ik kan je het exacte SQL template geven dat je zelf in de Supabase SQL Editor plakt met de waarden ingevuld.

