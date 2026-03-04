

## Schaalbaarheidsverbeteringen

Je analyse is accuraat. Hier is wat ik nu kan fixen in code/database, en wat handmatig of later moet.

### 1. Ontbrekende FK-indexes toevoegen (migratie)

8 foreign keys missen een index:

| Tabel | Kolom | Impact |
|-------|-------|--------|
| `work_orders` | `assigned_to` | Hoog — veel rijen, veel queries |
| `user_outlook_tokens` | `company_id` | Laag |
| `outlook_event_overrides` | `company_id` | Laag |
| `snelstart_relaties` | `connection_id` | Middel |
| `snelstart_artikelen` | `connection_id` | Middel |
| `snelstart_verkoopfacturen` | `connection_id` | Middel |
| `snelstart_verkooporders` | `connection_id` | Middel |
| `snelstart_offertes` | `connection_id` | Middel |

Eenvoudige migratie: `CREATE INDEX CONCURRENTLY` voor elk.

### 2. Rate limiting toevoegen aan zware endpoints

Voeg een gedeelde `checkRateLimit()` helper toe in `_shared/rate-limit.ts` die een `usage_events`-based check doet per company. Toepassen op:
- `generate-invoice-pdf` / `generate-quote-pdf` / `generate-workorder-pdf` (max 30/min per bedrijf)
- `sync-exact` / `sync-moneybird` / `sync-rompslomp` / `sync-invoice-eboekhouden` (max 5/min per bedrijf)
- `optimize-route` (max 10/min per bedrijf)
- `send-email` (max 30/min per bedrijf)

### 3. WhatsApp media lifecycle

Niet mogelijk via code — Supabase Storage heeft geen ingebouwd lifecycle-beleid. Alternatief: een cron edge function `cleanup-old-media` die bestanden ouder dan 90 dagen verwijdert.

### Wat NIET in scope is (handmatig/later)

- **Subscription/billing**: Vereist Stripe-integratie + plan-management UI — apart project
- **Feature flagging per plan**: `enabled_features` bestaat al, maar er is geen koppeling met een betalingsplan
- **DB connection limits**: Supabase plan upgrade nodig
- **Onboarding provisioning**: `company-signup` bestaat, maar geautomatiseerd betaal-pad ontbreekt
- **Ongebruikte indexes opruimen**: Vereist productie-query-analyse (pg_stat_user_indexes) om te bepalen welke echt ongebruikt zijn

### Aanpak

1. Migratie: 8 ontbrekende indexes
2. Nieuwe shared helper: `_shared/rate-limit.ts`
3. Rate limiting toevoegen aan 8 edge functions
4. Optioneel: `cleanup-old-media` cron function

