

## Plan: Super Admin Error Logs Dashboard

### Wat we bouwen

Een nieuw "Errors" tab op de Super Admin pagina waar alle edge function- en webhook-fouten realtime zichtbaar zijn. Hiermee kun je problemen zien en oplossen voordat klanten contact opnemen.

### Architectuur

```text
Edge Function error → logError() → edge_function_errors tabel
                                            ↓
                        Super Admin UI ← SELECT (is_super_admin)
```

### Stap 1: Database tabel `edge_function_errors`

Nieuwe tabel met kolommen:
- `id` (uuid, PK)
- `company_id` (uuid, nullable — sommige errors zijn niet tenant-gebonden)
- `function_name` (text — bijv. "whatsapp-send", "meta-webhook")
- `error_message` (text)
- `error_details` (jsonb — stack trace, request context, etc.)
- `severity` (text — "error", "warning")
- `resolved` (boolean, default false)
- `created_at` (timestamptz)

RLS: alleen `is_super_admin()` mag SELECT/UPDATE. INSERT via service role vanuit edge functions.

### Stap 2: Shared helper `_shared/error-logger.ts`

Een fire-and-forget functie vergelijkbaar met `logUsage()`:

```typescript
export async function logEdgeFunctionError(
  supabaseAdmin: SupabaseClient,
  functionName: string,
  errorMessage: string,
  details: Record<string, unknown> = {},
  companyId?: string
): Promise<void> { ... }
```

### Stap 3: Edge Functions integreren

De `logEdgeFunctionError()` aanroepen in catch-blokken van de belangrijkste functies:
- `whatsapp-send`, `whatsapp-webhook`
- `meta-webhook`, `meta-api`
- `send-email`, `fetch-emails`
- `generate-invoice-pdf`, `generate-quote-pdf`, `generate-workorder-pdf`
- `reminder-scan`
- `sync-rompslomp`, `sync-moneybird`, `sync-invoice-eboekhouden`
- `outlook-send`, `outlook-callback`

### Stap 4: UI Component `SuperAdminErrors.tsx`

Nieuw component met:
- Tabel met recente errors (function naam, bedrijf, foutmelding, tijdstip)
- Severity badges (rood voor error, oranje voor warning)
- "Opgelost" toggle per error
- Filter op function naam en severity
- Auto-refresh elke 30 seconden

### Stap 5: Tab toevoegen aan SuperAdminPage

Nieuw tab "Errors" met een AlertTriangle icoon en een badge met het aantal onopgeloste errors.

### Omvang

- 1 migratie (tabel + RLS)
- 1 nieuw shared module (`_shared/error-logger.ts`)
- ~12 edge functions aanpassen (catch-blokken)
- 1 nieuw component (`SuperAdminErrors.tsx`)
- 1 bestaand bestand aanpassen (`SuperAdminPage.tsx`)

