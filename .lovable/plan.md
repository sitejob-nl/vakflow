

## Probleem

De `syncCustomerToProvider` in `useCustomers.ts` stuurt `action: "sync-customer"` naar alle providers, maar alleen `sync-invoice-eboekhouden` heeft deze actie geimplementeerd. Rompslomp en Moneybird retourneren een fout omdat ze de actie niet kennen.

De client-side code is correct - hij checkt al de `accounting_provider` en stuurt alleen naar het gekoppelde pakket. Het probleem zit in de edge functions.

## Oplossing

Voeg een `sync-customer` actie toe aan beide edge functions, gemodelleerd op de bestaande bulk `sync-contacts` logica (die al werkt).

### 1. `supabase/functions/sync-rompslomp/index.ts`

Voeg een `sync-customer` handler toe (na de `test` actie, rond regel 143):
- Haal de klant op via `customer_id`
- Als `rompslomp_contact_id` al bestaat: skip (contact bestaat al)
- Zo niet: map de klantdata naar Rompslomp formaat (hergebruik de mapping uit regels 158-170 van `sync-contacts`)
- POST naar `/contacts`
- Schrijf het `rompslomp_contact_id` terug naar de `customers` tabel

### 2. `supabase/functions/sync-moneybird/index.ts`

Voeg een vergelijkbare `sync-customer` handler toe (na de `test` actie, rond regel 161):
- Haal de klant op via `customer_id`
- Als `moneybird_contact_id` al bestaat: skip
- Zo niet: map naar Moneybird formaat (hergebruik mapping uit regels 177-188 van `sync-contacts`)
- POST naar `contacts`
- Schrijf het `moneybird_contact_id` terug

### Bestanden te wijzigen
- `supabase/functions/sync-rompslomp/index.ts` - sync-customer actie toevoegen
- `supabase/functions/sync-moneybird/index.ts` - sync-customer actie toevoegen

Geen wijzigingen nodig in `useCustomers.ts` - de client-side code is al correct.

