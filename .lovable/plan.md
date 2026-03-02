

## Plan: Rompslomp omzetten naar API token (geen OAuth)

De huidige implementatie gebruikt OAuth via SiteJob Connect (client_id, client_secret, tenant registratie, popup flow). Dit wordt vervangen door een simpele API token flow: bedrijf vult hun Rompslomp API token + company_id in, en het systeem praat direct met de Rompslomp API.

### Database

**Migratie — kolommen toevoegen + opruimen op `companies`:**
- Toevoegen: `rompslomp_api_token` (text, nullable) — het API token uit Rompslomp instellingen
- Bestaande kolommen `rompslomp_tenant_id`, `rompslomp_webhook_secret` worden niet meer gebruikt voor OAuth maar kunnen blijven staan (backward compat). `rompslomp_company_id` wordt hergebruikt voor het Rompslomp bedrijfs-ID dat de gebruiker invult.

### Edge function: `sync-rompslomp/index.ts`

Vereenvoudigen:
- **Verwijder** `getRompslompToken()` (SiteJob Connect token call)
- Lees `rompslomp_api_token` en `rompslomp_company_id` uit de `companies` tabel
- Gebruik het API token direct als Bearer token + vaste base URL `https://api.rompslomp.nl/api/v1`
- Fix de API endpoints: `/invoices` → `/sales_invoices`, wrapper `invoice` → `sales_invoice`, `price` → `price_per_unit`, `invoice_lines_attributes` → `invoice_lines`
- Controleer "verbonden" op basis van `rompslomp_api_token` + `rompslomp_company_id` (niet tenant_id/webhook_secret)

### Edge function: `rompslomp-register/index.ts`

Kan verwijderd worden — niet meer nodig (geen OAuth registratie).

### Edge functions: `rompslomp-config/index.ts`, `rompslomp-webhook/index.ts`

Blijven bestaan maar worden niet actief gebruikt bij API token flow. Kunnen later opgeruimd worden.

### Frontend: `SettingsPage.tsx`

**Koppelingen tab:**
- Vervang "Client ID" en "Client Secret" velden door:
  - **API Token** (text/password input)
  - **Company ID** (text input, met uitleg hoe te vinden)
- Sla op naar `rompslomp_api_token` en `rompslomp_company_id` op de companies tabel

**Boekhouding tab:**
- Verwijder de hele OAuth popup flow ("Koppel Rompslomp" knop met rompslomp-register + SiteJob Connect popup)
- "Verbonden" check: `rompslomp_api_token` + `rompslomp_company_id` aanwezig
- Sync-knoppen (push/pull contacten/facturen, betaalstatus) blijven exact hetzelfde
- "Test verbinding" knop toevoegen die `sync-rompslomp` met `action: "test"` aanroept
- Ontkoppelen: wist `rompslomp_api_token`, `rompslomp_company_id`, `rompslomp_company_name`

### Hooks: `useInvoices.ts`

Geen wijzigingen — de mutations roepen `sync-rompslomp` aan, die intern verandert.

### Bestanden

| Bestand | Actie |
|---|---|
| Migratie SQL | Nieuw: `rompslomp_api_token` kolom |
| `supabase/functions/sync-rompslomp/index.ts` | Herschrijven: direct API token, fix endpoints |
| `supabase/functions/rompslomp-register/index.ts` | Verwijderen |
| `src/pages/SettingsPage.tsx` | Aanpassen: API token velden, verwijder OAuth flow |

