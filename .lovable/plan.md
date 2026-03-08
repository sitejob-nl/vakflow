

## Plan: WeFact producten sync + uitgebreide betaalstatus

Twee uitbreidingen aan de bestaande `sync-wefact/index.ts`, consistent met het huidige action-routing patroon.

---

### 1. Producten sync (materials koppeling)

Twee nieuwe actions toevoegen aan `sync-wefact/index.ts`:

**`sync-products`** — Push materialen zonder WeFact ID naar WeFact als producten:
- Map `name` → `ProductName`, `name` → `ProductKeyPhrase`, `unit_price` → `PriceExcl`, `unit` → `NumberSuffix`
- Sla WeFact `Identifier` op in een nieuw `wefact_product_id` veld op `materials`

**`pull-products`** — Pull producten uit WeFact en upsert in `materials`:
- Map `ProductName` → `name`, `PriceExcl` → `cost_price`, `NumberSuffix` → `unit`
- Match op `wefact_product_id`

**Database:** Eén kolom toevoegen:
```sql
ALTER TABLE materials ADD COLUMN wefact_product_id text;
```

---

### 2. Uitgebreide betaalstatus

Bestaande `pull-invoice-status` action uitbreiden met extra velden:
- `AmountPaid`, `AmountOutstanding`, `PaymentURL` ophalen en loggen
- Bij status 3 (deels betaald) de factuur op "verzonden" laten staan maar `notes` updaten met betaald bedrag

---

### 3. Frontend: sync knoppen voor producten

In `SettingsPage.tsx` bij de WeFact sectie twee knoppen toevoegen:
- "Producten pushen" → `sync-products`
- "Producten pullen" → `pull-products`

---

### Bestanden

| Bestand | Wijziging |
|---------|-----------|
| Supabase migratie | `wefact_product_id` op `materials` |
| `supabase/functions/sync-wefact/index.ts` | 2 actions toevoegen |
| `src/pages/SettingsPage.tsx` | Sync knoppen |

