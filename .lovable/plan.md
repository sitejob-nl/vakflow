

# Migratie Exact Online naar nieuwe architectuur

## Huidige situatie

De huidige `sync-exact` edge function is een monoliet (965 regels) die tokens ophaalt via `exact_config.tenant_id` + `webhook_secret` bij de SiteJob Connect service. Die service geeft "Tenant not found" terug, waardoor geen enkele sync werkt.

De ge-uploade bestanden komen uit een ander project met een modulaire opzet: aparte edge functions per entity, een `exact_online_connections` tabel, en een `getExactTokenFromConnection` helper.

## Wat moet er gebeuren

### 1. Database migratie

Nieuwe tabel `exact_online_connections`:
- `id`, `division_id` (text, uniek), `tenant_id`, `webhook_secret`, `exact_division` (int), `company_name`, `region`, `is_active`, `connected_at`, `webhooks_enabled`, `company_id` (FK naar companies)

Optioneel: `exact_sync_queue` tabel voor async verwerking (kan later).

### 2. Shared helper: `_shared/exact-connect.ts`

Functie `getExactTokenFromConnection(connection)` die:
- De SiteJob Connect service aanroept met `tenant_id` + `webhook_secret` 
- Een fresh `access_token`, `base_url`, `division` teruggeeft
- Encrypted secrets decrypteert via `_shared/crypto.ts`

### 3. Edge functions — modulair opsplitsen

Vervang de monoliet `sync-exact` door aparte functies, **aangepast aan Vakflow's datamodel** (niet 1-op-1 kopie van de uploads):

| Functie | Acties | Bron tabel |
|---------|--------|------------|
| `exact-api` | Proxy voor directe API calls | - |
| `exact-sync-customers` | push/pull/sync | `customers` (met `company_id`, niet `division_id`) |
| `exact-sync-contacts` | push/pull/sync | `customers` (contactpersonen) |
| `exact-sync-invoices` | push/pull_status/sync | `invoices` + `invoice_items` |
| `exact-sync-quotes` | push/pull_status | `quotes` + `quote_items` |
| `exact-sync-items` | push/pull/sync | `materials` |
| `exact-config-webhook` | OAuth callback handler | `exact_online_connections` |

Elke functie:
- Accepteert `{ action, divisionId, ...optionalIds }`
- Gebruikt `authenticateRequest` of `requireAuthOrService` 
- Haalt connection op via `exact_online_connections.division_id`
- Roept `getExactTokenFromConnection` aan
- Mapt van/naar Vakflow's tabellen (niet Abitare's)

### 4. Aanpassingen per functie t.o.v. uploads

De uploads refereren kolommen die niet bestaan in Vakflow:
- `division_id` op customers → Vakflow gebruikt `company_id`
- `customer_number`, `first_name`, `last_name` → Vakflow heeft `name`
- `orders` + `order_lines` → Vakflow heeft `invoices` + `items` (JSON)
- `products` → Vakflow heeft `materials`
- `suppliers`, `supplier_orders` → bestaan niet in Vakflow

Elke functie wordt aangepast om met Vakflow's schema te werken. Purchase orders en sales orders worden niet geïmplementeerd (geen Vakflow-equivalent).

### 5. Frontend hook: `useExactOnline.ts`

Nieuw bestand met hooks voor:
- `useExactOnlineConnections` — lijst connections
- `useTestExactConnection` — test verbinding
- `useSyncCustomers` — push/pull klanten
- `useSyncInvoices` — push/pull facturen  
- `useSyncQuotes` — push/pull offertes
- `useSyncItems` — push/pull materialen

Vervangt de Exact-hooks in `useInvoices.ts`.

### 6. UI updates

- `ExactAdmin.tsx` — herschrijven met connection picker (division selector) en sync-acties per entity
- `ProviderSyncPanel.tsx` — Exact-acties updaten naar nieuwe hooks met `divisionId` parameter
- `SettingsAccountingTab.tsx` — registratie/disconnect flow updaten naar `exact_online_connections`

### 7. Migratie exact_config → exact_online_connections

Data-migratie: bestaande `exact_config` rijen converteren naar `exact_online_connections` rijen, zodat bestaande koppelingen behouden blijven.

## Volgorde van implementatie

1. DB migratie (tabel + data conversie)
2. `_shared/exact-connect.ts` helper
3. Edge functions (exact-api, exact-sync-customers, etc.)
4. `useExactOnline.ts` hook
5. ExactAdmin + ProviderSyncPanel + Settings updates
6. Oude `sync-exact` verwijderen + config.toml updaten

## Scope

- **Wel**: Customers, Contacts, Invoices, Quotes, Items (Materials)
- **Niet**: Purchase orders, Sales orders, Suppliers (bestaan niet in Vakflow)
- **Later**: `exact_sync_queue` voor async batch verwerking

