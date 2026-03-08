

## Plan: Moneybird Integratie Uitbreiden

Vier uitbreidingen op de bestaande `sync-moneybird` edge function: webhook ontvanger, producten sync, contracten/abonnementen koppeling, en verbeteringen.

---

### 1. Webhook Ontvanger

**Doel:** Realtime updates ontvangen van Moneybird (factuurstatus, betaalstatus) ipv polling.

**Database:**
- Nieuwe tabel `moneybird_webhook_config` met `company_id`, `webhook_id` (Moneybird's webhook ID), `enabled_events`, `created_at`
- Of simpeler: opslaan als `moneybird_webhook_id` kolom op `companies` tabel

**Edge Function:** `moneybird-webhook` (nieuw, `verify_jwt = false`)
- Ontvangt POST van Moneybird met event payload
- Valideert dat het event van een bekende administratie komt
- Verwerkt events:
  - `sales_invoice_updated` / `sales_invoice_state_changed` → update `invoices.status` en `paid_at`
  - `contact_changed` → update klantgegevens
  - `estimate_state_changed` → update `quotes.status`
- Lookup company via `moneybird_administration_id`

**Webhook registratie:** Nieuw action `register-webhook` in `sync-moneybird`:
- POST naar `/{admin_id}/webhooks.json` met callback URL
- Slaat Moneybird webhook ID op voor cleanup

**Webhook deregistratie:** Action `unregister-webhook` om webhook te verwijderen bij ontkoppelen.

**Config:** `supabase/config.toml` entry met `verify_jwt = false`

---

### 2. Producten Sync

**Doel:** Materialen-catalogus koppelen aan Moneybird producten, zodat factuurregels de juiste `product_id` en `ledger_account_id` meekrijgen.

**Database:**
- Kolom `moneybird_product_id` (text) toevoegen aan `materials` tabel

**Edge Function acties** (in bestaande `sync-moneybird`):
- `sync-products` — push materialen naar Moneybird als producten
- `pull-products` — importeer Moneybird producten als materialen
- `create-invoice` en `create-quote` aanpassen: als item gekoppeld is aan materiaal met `moneybird_product_id`, die meesturen in `details_attributes`

---

### 3. Contracten → Moneybird Abonnementen

**Doel:** Bij aanmaken van een contract optioneel een Moneybird subscription aanmaken.

**Database:**
- Kolom `moneybird_subscription_id` (text) toevoegen aan `contracts` tabel

**Edge Function acties** (in bestaande `sync-moneybird`):
- `create-subscription` — maakt Moneybird subscription aan op basis van contract
- `sync-subscriptions` — bulk push
- `pull-subscriptions` — importeer Moneybird abonnementen als contracten

**Frontend:** In `ContractDialog` optie tonen "Sync naar Moneybird" wanneer provider = moneybird.

---

### 4. Bug Fixes / Verbeteringen

- **`MB_BASE` constante ontbreekt** — staat niet in de zichtbare code, verifiëren en toevoegen
- **Tax rate ID:** Bij create-invoice/quote nu geen `tax_rate_id` meegegeven → ophalen van standaard BTW tarief via `tax_rates` endpoint en cachen
- **Reference veld:** Bij facturen/offertes het `reference` veld vullen met Vakflow factuurnummer als cross-referentie
- **Bestaand contact updaten:** Bij `sync-customer` als contact al bestaat, PATCH ipv skippen (gegevens kunnen gewijzigd zijn)
- **Due date meegeven** bij facturen (wordt nu `undefined` als niet gezet)

---

### Bestanden

| Bestand | Actie |
|---------|-------|
| Migratie | `moneybird_product_id` op materials, `moneybird_subscription_id` op contracts |
| `supabase/functions/moneybird-webhook/index.ts` | Nieuw |
| `supabase/functions/sync-moneybird/index.ts` | Uitbreiden met webhook-registratie, producten, subscriptions, fixes |
| `supabase/config.toml` | Entry voor `moneybird-webhook` |
| `src/components/ContractDialog.tsx` | Moneybird sync optie |
| `src/components/MaterialsSettings.tsx` | Moneybird product ID tonen |
| `src/pages/SettingsPage.tsx` | Webhook registratie knop bij Moneybird koppeling |

