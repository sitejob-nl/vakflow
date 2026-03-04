

## Plan: Exact Online integratie via SiteJob Connect

### Overzicht

De Exact Online integratie volgt hetzelfde patroon als WhatsApp: registreer een tenant bij SiteJob Connect, open een setup-popup, ontvang config-push, en gebruik tokens on-demand voor API calls.

### Database wijzigingen

**Nieuwe tabel: `exact_config`** (vergelijkbaar met `whatsapp_config`)

| Kolom | Type | Beschrijving |
|-------|------|-------------|
| id | uuid PK | |
| company_id | uuid UNIQUE NOT NULL | FK naar companies |
| tenant_id | uuid | Van SiteJob Connect |
| webhook_secret | text | Voor token requests |
| division | integer | Exact Online administratie |
| company_name_exact | text | Naam in Exact |
| region | text | nl/be/de etc. |
| status | text | pending / connected / error |
| created_at | timestamptz | |
| updated_at | timestamptz | |

RLS policies: company-scoped lezen/schrijven + super_admin, insert/delete voor admins.

### Edge Functions

**1. `exact-register` (nieuw)** — Registreer tenant bij Connect
- Authenticated (JWT via authenticateRequest)
- Haalt company_id op, checkt bestaande config
- Stuurt POST naar `exact-register-tenant` met unieke webhook_url (`...exact-webhook?company_id={cid}`)
- Slaat tenant_id + webhook_secret op in `exact_config`
- Stale pending configs worden verwijderd (zelfde patroon als WhatsApp)

**2. `exact-config` (nieuw, verify_jwt=false)** — Ontvangt config-push van Connect
- Verifieert X-Webhook-Secret header
- Slaat division, company_name, region op
- Zet status op "connected"
- Ondersteunt disconnect actie

**3. `exact-webhook` (nieuw, verify_jwt=false)** — Ontvangt doorgestuurde Exact webhooks
- Verifieert X-Webhook-Secret header
- Routeert op company_id (query param) of division
- Verwerkt SalesInvoices/Accounts events (fase 2, initieel alleen loggen)

**4. `sync-exact` (nieuw)** — Sync contacten/facturen met Exact Online
- Authenticated
- Haalt verse token op via Connect `exact-token` endpoint
- Acties: test, sync-contacts, pull-contacts, sync-invoices, pull-invoices, pull-status
- Gebruikt OData v3 API calls naar Exact Online

### Frontend wijzigingen

**`src/pages/SettingsPage.tsx`** — Vervang de "Binnenkort beschikbaar" placeholder (regel 1702-1707) door een volledige Exact Online sectie:

- **Niet verbonden**: "Koppel Exact Online" knop die:
  1. `exact-register` Edge Function aanroept
  2. Setup popup opent (`connect.sitejob.nl/exact-setup?tenant_id=...`)
  3. Luistert naar `exact-connected` postMessage
- **Verbonden**: Status tonen + sync knoppen (contacten, facturen) + ontkoppelen
- Zelfde UI patroon als Rompslomp/Moneybird sectie

**`src/hooks/useInvoices.ts`** — Nieuwe sync hooks toevoegen:
- `useSyncContactsExact`, `usePullContactsExact`
- `useSyncInvoicesExact`, `usePullInvoicesExact`
- `usePullInvoiceStatusExact`

### Config.toml updates

```toml
[functions.exact-config]
verify_jwt = false

[functions.exact-webhook]
verify_jwt = false
```

### Bestanden overzicht

| Bestand | Actie |
|---------|-------|
| Migration | Nieuwe `exact_config` tabel + RLS |
| `supabase/functions/exact-register/index.ts` | Nieuw — tenant registratie |
| `supabase/functions/exact-config/index.ts` | Nieuw — config push ontvanger |
| `supabase/functions/exact-webhook/index.ts` | Nieuw — webhook ontvanger (initieel: loggen) |
| `supabase/functions/sync-exact/index.ts` | Nieuw — sync contacten/facturen |
| `supabase/config.toml` | Toevoegen exact-config + exact-webhook |
| `src/pages/SettingsPage.tsx` | Exact Online UI (vervang placeholder) |
| `src/hooks/useInvoices.ts` | Sync hooks voor Exact |

### Implementatievolgorde

1. Database tabel + RLS
2. Edge Functions (register → config → sync)
3. Frontend UI + hooks
4. Webhook handler (initieel alleen loggen)

