

## Plan: WeFact integratie toevoegen

WeFact wordt als 6e boekhoudpakket toegevoegd, volledig conform het bestaande patroon (Rompslomp/Moneybird/e-Boekhouden).

---

### 1. Database migratie

Kolommen toevoegen aan bestaande tabellen:

```sql
-- companies: WeFact API key opslag
ALTER TABLE companies ADD COLUMN wefact_api_key text;

-- customers: WeFact debtor koppeling
ALTER TABLE customers ADD COLUMN wefact_debtor_code text;

-- invoices: WeFact factuur koppeling
ALTER TABLE invoices ADD COLUMN wefact_id text;

-- quotes: WeFact offerte koppeling
ALTER TABLE quotes ADD COLUMN wefact_id text;
```

De `companies_safe` view moet worden bijgewerkt om `wefact_api_key` te maskeren (boolean `has_wefact_key`).

---

### 2. Edge Function: `sync-wefact`

Nieuw bestand `supabase/functions/sync-wefact/index.ts` — dezelfde structuur als `sync-rompslomp`:

- **Helper:** `wefactRequest(controller, action, params)` — POST naar `https://api.mijnwefact.nl/v2/` met `application/x-www-form-urlencoded`
- **Acties:**
  - `test` — `debtor.list` met limit=1 om verbinding te testen
  - `sync-customer` — Push klant als debiteur (`debtor.add`)
  - `sync-contacts` — Bulk push klanten zonder `wefact_debtor_code`
  - `pull-contacts` — Pull debiteuren (`debtor.list`) en upsert in `customers`
  - `create-invoice` — Push factuur (`invoice.add`) met `InvoiceLines`
  - `sync-invoices` — Bulk push facturen zonder `wefact_id`
  - `pull-invoices` — Pull facturen (`invoice.list`) en importeer
  - `pull-invoice-status` — Pull status updates voor bestaande facturen
  - `sync-quote` / `pull-quotes` — Offerte sync via `pricequote` controller

Config in `supabase/config.toml`: `verify_jwt = false` (authenticatie in code).

---

### 3. Edge Function: `save-smtp-credentials` uitbreiden

`wefact_api_key` toevoegen aan de bestaande encrypt/save flow, net als `rompslomp_api_token` en `moneybird_api_token`.

---

### 4. Frontend: SettingsPage.tsx

- **Boekhoudpakket dropdown:** `<SelectItem value="wefact">WeFact</SelectItem>` toevoegen
- **WeFact configuratie sectie** (wanneer `accountingProvider === "wefact"`):
  - API Key invoerveld (password type)
  - "Test verbinding" knop
  - Sync knoppen: Contacten pushen/pullen, Facturen pushen/pullen, Offerte sync, Status sync
- **Opslaan:** `wefact_api_key` meesturen naar `save-smtp-credentials` edge function
- State variabelen: `wefactApiKey`, `wefactConnected`, `wefactTesting`, sync-states

---

### 5. Frontend: useInvoices.ts hooks

Nieuwe hooks toevoegen (zelfde patroon als Rompslomp/Moneybird):
- `useSyncContactsWefact`, `usePullContactsWefact`
- `useSyncInvoicesWefact`, `usePullInvoicesWefact`, `usePullInvoiceStatusWefact`
- `useSyncQuotesWefact`, `usePullQuotesWefact`

---

### 6. Frontend: InvoiceDialog.tsx auto-sync

`accountingProvider === "wefact"` toevoegen aan de auto-sync check bij factuur aanmaken, met `funcName = "sync-wefact"` en `providerLabel = "WeFact"`.

---

### 7. Companies_safe view updaten

De view bijwerken zodat `wefact_api_key` niet wordt blootgesteld maar wel een `has_wefact_key` boolean beschikbaar is.

---

### Bestanden

| Bestand | Actie |
|---------|-------|
| Supabase migratie | Kolommen + view update |
| `supabase/functions/sync-wefact/index.ts` | Nieuw |
| `supabase/config.toml` | Entry toevoegen |
| `supabase/functions/save-smtp-credentials/index.ts` | `wefact_api_key` toevoegen |
| `src/pages/SettingsPage.tsx` | WeFact UI sectie + dropdown |
| `src/hooks/useInvoices.ts` | Sync hooks |
| `src/components/InvoiceDialog.tsx` | Auto-sync |
| `src/components/QuoteDialog.tsx` | Auto-sync (als dit patroon al bestaat) |

