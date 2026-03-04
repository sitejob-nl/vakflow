

## Plan: SnelStart B2B API v2 Integratie

Dit is een grote integratie die we in fasen bouwen, volgend op het bestaande patroon van de Exact Online integratie.

### Fase 1: Database & Shared Helper

**Migration SQL** -- Alle tabellen aanmaken:
- `snelstart_connections` (company_id, client_key, subscription_key, access_token, token_expires_at)
- `snelstart_relaties`, `snelstart_artikelen`, `snelstart_verkoopfacturen`, `snelstart_verkooporders`, `snelstart_offertes` (elk met connection_id FK, gemapte velden + raw_data JSONB)
- `snelstart_sync_status` (connection_id, resource_type, last_sync_at, status, error_message)
- RLS policies op alle tabellen via `get_my_company_id()` + join op `snelstart_connections.company_id`
- `accounting_provider` enum in `companies` al bestaat, dus SnelStart wordt gewoon een nieuwe waarde die de UI herkent

**Shared helper** `supabase/functions/_shared/snelstart-client.ts`:
- `getSnelstartToken(connection)` -- POST naar `https://auth.snelstart.nl/b2b/token`, cache in DB, refresh als < 5 min resterend
- `snelstartFetch(connection, endpoint, method, body?)` -- generieke API call met `Authorization: Bearer` + `Ocp-Apim-Subscription-Key` headers
- `snelstartGetAll(connection, endpoint, filter?)` -- OData paginering met $skip/$top (max 500), 150ms delay tussen calls
- `getConnectionForCompany(adminClient, companyId)` -- haalt de actieve connectie op

### Fase 2: Edge Functions

Eén gecombineerde edge function per resource-type, CRUD via HTTP method:

| Function | Endpoints | JWT |
|----------|-----------|-----|
| `snelstart-relaties/index.ts` | CRUD /v2/relaties | verified in code |
| `snelstart-artikelen/index.ts` | CRUD /v2/artikelen + customFields, prijsafspraken | verified in code |
| `snelstart-offertes/index.ts` | CRUD /v2/offertes | verified in code |
| `snelstart-verkooporders/index.ts` | CRUD /v2/verkooporders + procesStatus | verified in code |
| `snelstart-facturen/index.ts` | READ facturen + CRUD boekingen + UBL | verified in code |
| `snelstart-sync/index.ts` | Delta/full sync engine | verify_jwt=false (cron) |

Alle functions gebruiken `authenticateRequest()` uit `_shared/supabase.ts` (behalve sync die ook service-role accepteert voor cron).

`supabase/config.toml` wordt uitgebreid met alle nieuwe functions (verify_jwt=false voor sync).

### Fase 3: Sync Engine

`snelstart-sync/index.ts`:
- Accepteert `{"sync_type": "delta"|"full", "connection_id?": "uuid"}`
- Delta: filter `ModifiedOn gt datetime'{last_sync}'`
- Full: geen filter, alles ophalen
- Per resource: upsert in lokale tabel, update `snelstart_sync_status`
- 150ms delay tussen API calls (rate limit bescherming)
- Sequentieel per connectie, niet parallel
- Foutafhandeling per resource (niet hele sync laten crashen)

### Fase 4: Frontend

**`src/pages/SettingsPage.tsx`** -- Uitbreiding "Koppelingen" tab:
- SnelStart kaart met status-indicator
- Invoervelden voor client_key + subscription_key
- Test-knop (GET /v2/echo/test)
- Sync status tabel uit `snelstart_sync_status`
- "Nu synchroniseren" knop

**`src/hooks/useSnelstart.ts`** -- React Query hooks:
- `useSnelstartConnection()` -- huidige connectie ophalen
- `useSaveSnelstartConnection()` -- opslaan/updaten
- `useTestSnelstartConnection()` -- test call
- `useSnelstartSyncStatus()` -- sync status ophalen
- `useTriggerSnelstartSync()` -- handmatige sync starten

**`src/lib/snelstart-api.ts`** -- Frontend API-laag voor CRUD operaties via `supabase.functions.invoke()`.

### Fase 5: pg_cron

SQL via insert tool (niet migratie):
- Hourly delta sync: `0 * * * *`
- Nightly full sync: `0 2 * * *`

### Beveiligingsgaranties

- `company_id` wordt altijd expliciet gezet via `authenticateRequest()` JWT validatie
- RLS policies op alle snelstart_* tabellen via `get_my_company_id()`
- Credentials (client_key, subscription_key) alleen leesbaar voor eigen bedrijf
- Sync function valideert company_id bij elke upsert
- Token wordt in DB gecacht, niet in client

### Volgorde van implementatie

1. Database migratie (alle tabellen + RLS)
2. Shared helper (`snelstart-client.ts`)
3. CRUD edge functions (begin met relaties als test)
4. Settings UI (verbinding + test)
5. Sync engine
6. Sync status UI
7. Frontend API-laag
8. pg_cron instellen

