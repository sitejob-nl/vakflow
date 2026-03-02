

## Plan: Rompslomp Boekhoudintegratie via SiteJob Connect

### Overzicht
Volledige Rompslomp-koppeling implementeren via SiteJob Connect (OAuth token management). Het patroon volgt de bestaande WhatsApp-integratie: een register edge function, config/webhook endpoints, en een sync edge function voor API calls.

### Database

**Nieuwe kolommen op `companies` tabel:**
- `rompslomp_tenant_id` (text, nullable) — tenant ID bij SiteJob Connect
- `rompslomp_webhook_secret` (text, nullable) — voor token-ophaling
- `rompslomp_company_id` (text, nullable) — Rompslomp bedrijfs-ID (gepusht via config)
- `rompslomp_company_name` (text, nullable) — Rompslomp bedrijfsnaam

**Nieuwe kolommen op `customers` tabel:**
- `rompslomp_contact_id` (text, nullable) — relatie-ID in Rompslomp

**Nieuwe kolommen op `invoices` tabel:**
- `rompslomp_id` (text, nullable) — factuur-ID in Rompslomp

### Edge Functions (4 nieuwe)

**1. `rompslomp-register` — Tenant registratie**
- Authenticatie: JWT (ingelogde admin)
- Registreert tenant bij SiteJob Connect met `client_id`, `client_secret` uit request body
- Slaat `tenant_id` + `webhook_secret` op in `companies` tabel
- Geeft `tenant_id` terug voor de setup-popup

**2. `rompslomp-config` — Config push ontvanger**
- Authenticatie: `X-Webhook-Secret` header (verify_jwt = false)
- Ontvangt `company_id` + `company_name` na succesvolle OAuth
- Ontvangt `disconnect` actie bij ontkoppeling
- Slaat gegevens op in `companies` tabel

**3. `rompslomp-webhook` — Webhook ontvanger**
- Authenticatie: `X-Webhook-Secret` header (verify_jwt = false)
- Ontvangt doorgestuurde Rompslomp events (invoice.created, etc.)
- Verwerkt relevante events (bijv. betaalstatus bijwerken)

**4. `sync-rompslomp` — API sync functie**
- Authenticatie: JWT (ingelogde admin)
- Haalt verse token op via SiteJob Connect (`rompslomp-token` endpoint)
- Acties: `test`, `sync-contacts`, `sync-invoices`, `pull-contacts`, `pull-invoices`, `pull-invoice-status`
- Structuur vergelijkbaar met `sync-invoice-eboekhouden`

### Frontend (SettingsPage.tsx)

**Boekhouding tab — Rompslomp sectie (vervangt "binnenkort beschikbaar"):**
1. **Niet gekoppeld:** "Koppel Rompslomp" knop → registreert tenant → opent popup naar `connect.sitejob.nl/rompslomp-setup?tenant_id=...`
2. **Gekoppeld:** Status tonen (bedrijfsnaam), sync-knoppen (contacten/facturen pushen/pullen), ontkoppel-knop
3. PostMessage listener voor `rompslomp-connected` event

**Koppelingen tab:**
- Bij selectie van "rompslomp": velden voor `client_id` en `client_secret` (OAuth credentials per bedrijf)
- Opslaan naar `companies` tabel

### Config (supabase/config.toml)
```
[functions.rompslomp-config]
verify_jwt = false

[functions.rompslomp-webhook]
verify_jwt = false
```

### Bestanden
- Nieuwe migratie: kolommen op `companies`, `customers`, `invoices`
- `supabase/functions/rompslomp-register/index.ts`
- `supabase/functions/rompslomp-config/index.ts`
- `supabase/functions/rompslomp-webhook/index.ts`
- `supabase/functions/sync-rompslomp/index.ts`
- `supabase/config.toml` — verify_jwt = false voor config + webhook
- `src/pages/SettingsPage.tsx` — Rompslomp UI in Boekhouding + Koppelingen tabs
- `src/hooks/useInvoices.ts` — Rompslomp sync mutations toevoegen

