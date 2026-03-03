

## Plan: Tenant-isolatie op Storage + Usage Tracking

### 1. Storage tenant-isolatie

**Probleem**: Beide private buckets (`whatsapp-media`, `work-order-photos`) hebben RLS policies die alleen checken of `auth.uid() IS NOT NULL`. Elke ingelogde gebruiker kan bestanden van andere tenants ophalen als ze het pad kennen.

**Oplossing**: Bestanden opslaan onder `{company_id}/...` prefix, en RLS policies die het pad matchen tegen de company van de gebruiker.

**Wijzigingen**:

| Bestand | Actie |
|---------|-------|
| SQL migration | Vervang storage RLS policies: SELECT/INSERT/DELETE alleen als `(storage.foldername(name))[1] = get_my_company_id()::text`, plus service_role INSERT voor webhooks |
| `supabase/functions/whatsapp-webhook/index.ts` | Upload pad wijzigen van `{msgType}/{uuid}.{ext}` naar `{companyId}/{msgType}/{uuid}.{ext}` |
| `src/components/PhotoUpload.tsx` | Upload pad wijzigen van `{workOrderId}/{type}/{uuid}.{ext}` naar `{companyId}/{workOrderId}/{type}/{uuid}.{ext}` |

**Bestaande bestanden**: Oude paden (zonder company_id prefix) werken niet meer met de nieuwe RLS. We voegen een fallback-policy toe voor service_role zodat edge functions nog steeds kunnen uploaden, en de signed URL flow via service_role key (die RLS bypassed) blijft werken voor oude bestanden. Bij nieuwe uploads wordt het correcte pad gebruikt.

### 2. Usage tracking tabel

**Probleem**: Geen zicht op hoeveel WhatsApp berichten, emails of API calls per tenant. Geen basis voor facturering of misbruikdetectie.

**Oplossing**: Een `usage_events` tabel + een helper function die edge functions aanroepen bij elke billable actie.

**Schema**:
```text
usage_events
  id            uuid PK
  company_id    uuid NOT NULL (FK companies)
  event_type    text NOT NULL  -- 'whatsapp_sent', 'whatsapp_received', 'email_sent', 'api_call'
  metadata      jsonb DEFAULT '{}'
  created_at    timestamptz DEFAULT now()

INDEX op (company_id, event_type, created_at)
```

**RLS**: Alleen super_admins kunnen lezen. Insert via service_role (edge functions).

**Edge function wijzigingen** — logging toevoegen in:
- `whatsapp-send/index.ts` → log `whatsapp_sent`
- `whatsapp-webhook/index.ts` → log `whatsapp_received`
- `send-email/index.ts` → log `email_sent`
- `trigger-email-automation/index.ts` → log `email_automation_sent`

**Super Admin UI**: Uitbreiding van `SuperAdminPage.tsx` met een usage-tab die per company de counts toont (deze maand / vorige maand) via een `get_usage_summary()` RPC.

**RPC functie**:
```text
get_usage_summary(p_company_id uuid, p_start timestamptz, p_end timestamptz)
RETURNS TABLE(event_type text, event_count bigint)
-- SECURITY DEFINER, alleen callable door super_admins
```

### Samenvatting stappen

1. SQL migration: nieuwe storage RLS policies + `usage_events` tabel + `get_usage_summary` RPC
2. Webhook + PhotoUpload: company_id prefix in storage paden
3. Edge functions: usage event logging na elke billable actie
4. Super Admin UI: usage tab met per-tenant overzicht

