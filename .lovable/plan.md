

# Plan: Auto-sync klanten naar boekhoudprovider

## Twee wijzigingen

### 1. `sync-exact` invoice pre-check: auto-push klanten zonder exact_account_id
In de `sync-invoices` case (regel 398-478): voor de invoice loop, haal alle klanten op die in de facturen voorkomen maar geen `exact_account_id` hebben. Push deze automatisch naar Exact via dezelfde POST `/crm/Accounts` logica die al in `sync-contacts` staat. Sla het resultaat op in `customers.exact_account_id`. Ga daarna door met de factuur-sync.

### 2. `syncCustomerToProvider` uitbreiden met Exact, WeFact en SnelStart
In `src/hooks/useCustomers.ts` (regel 20-47): de huidige `syncCustomerToProvider` functie ondersteunt alleen eboekhouden, rompslomp en moneybird. Toevoegen:
- `exact` → `sync-exact` met `{ action: "sync-single-contact", customer_id }`
- `wefact` → `sync-wefact` met `{ action: "sync-contacts" }` (WeFact heeft geen single-customer action, maar we kunnen die toevoegen)
- `snelstart` → `snelstart-relaties` met `{ action: "sync-customer", customer_id }`

### 3. Nieuwe action `sync-single-contact` in sync-exact
De bestaande `sync-contacts` pusht alle klanten in bulk. We voegen een lichtgewicht `sync-single-contact` action toe die 1 klant pusht naar Exact (zelfde logica als de loop in sync-contacts, maar voor 1 record).

### 4. Nieuwe action `sync-customer` in sync-wefact
Vergelijkbaar: accepteert `customer_id`, haalt 1 klant op, pusht naar WeFact als debiteur.

## Bestanden

| Bestand | Wijziging |
|---------|-----------|
| `supabase/functions/sync-exact/index.ts` | Nieuwe action `sync-single-contact` + pre-check in `sync-invoices` |
| `supabase/functions/sync-wefact/index.ts` | Nieuwe action `sync-customer` voor 1 klant |
| `src/hooks/useCustomers.ts` | `syncCustomerToProvider` uitbreiden met exact, wefact, snelstart |

