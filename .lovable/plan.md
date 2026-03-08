

# Exact Online fixes — 8 wijzigingen in 1 bestand

Fixes 9 (e-Boekhouden vatCode) en 10 (Rompslomp pull-quotes BTW) zijn al geïmplementeerd in de vorige batch. Deze batch focust op de 8 sync-exact fixes.

## Bestand: `supabase/functions/sync-exact/index.ts`

### Fix 1: sync-invoices status filter (regel 295)
`.eq("status", "verstuurd")` → `.in("status", ["verzonden", "verstuurd"])`

### Fix 2: pull-status volledig implementeren (regels 460-466)
Huidige code haalt open facturen op uit Exact maar doet er niets mee (`updated: 0`).

Nieuwe implementatie:
- Haal lokale facturen op met `exact_id IS NOT NULL AND status != 'betaald'`
- Per lokale factuur: zoek in de Exact-resultaten of `Status === 50` (Betaald)
- Als betaald: update lokale factuur naar `status: "betaald"`, `paid_at: new Date().toISOString().split("T")[0]`
- Return `{ checked, updated, errors }`

### Fix 3: create-invoice actie toevoegen (nieuw case block)
Accepteert `invoice_id` in body. Haal factuur + klant op. Als klant geen `exact_account_id` heeft, push klant eerst via `exactPost` naar `crm/Accounts`. Push factuur via `salesinvoice/SalesInvoices`. Sla `exact_id` op.

### Fix 4: create-quote actie toevoegen (nieuw case block)
Accepteert `quote_id` in body. Haal offerte + klant op. Push via `crm/Quotations`. Zelfde auto-create klant patroon als fix 3.

### Fix 5: sync-invoices qty mapping (regel 315)
`Quantity: item.quantity || 1` → `Quantity: item.qty || item.quantity || 1`

### Fix 6: pull-invoices BTW dynamisch (regels 419-421)
Huidige hardcoded `1.21` vervangen door:
```
const vatPct = 21; // Exact doesn't expose VAT% in SalesInvoices $select, default to 21
subtotal: Math.round(amount / (1 + vatPct / 100) * 100) / 100,
vat_amount: Math.round((amount - amount / (1 + vatPct / 100)) * 100) / 100,
vat_percentage: vatPct,
```
Structureel identiek maar klaar voor toekomstige uitbreiding als Exact VAT-data beschikbaar wordt.

### Fix 7: pull-quotes importeren als lokale quotes (regels 534-551)
Huidige code retourneert alleen een lijst. Uitbreiden met:
- Zoek klant via `OrderAccount` → `exact_account_id` mapping
- Insert in `quotes` tabel met `exact_id`, deduplicatie op `exact_id`
- Behoud bestaande list-response maar voeg `imported` count toe

### Fix 8: sync-contacts — update bestaande klanten (regels 174-228)
Voeg `exactPut` helper toe (zelfde als `exactPost` maar met `method: "PUT"`).
Na de huidige "push new contacts" loop: voeg een tweede loop toe voor klanten die wél een `exact_account_id` hebben. PUT hun gegevens naar `crm/Accounts(guid'{ID}')`.

## Hulpfunctie toevoegen
`exactPut` — identiek aan `exactPost` maar met `method: "PUT"`. Nodig voor fix 8.

## Geen database-wijzigingen nodig
Alle kolommen (`exact_id`, `exact_account_id`, `paid_at`, etc.) bestaan al.

## Samenvatting wijzigingen

| Fix | Type | Impact |
|-----|------|--------|
| 1 | Status filter | Kritiek — facturen worden nu gevonden |
| 2 | Pull-status | Kritiek — betalingsstatus wordt bijgewerkt |
| 3 | Create-invoice | Medium — push-on-create support |
| 4 | Create-quote | Medium — push-on-create support |
| 5 | Qty mapping | Medium — correcte aantallen |
| 6 | BTW dynamisch | Medium — geen hardcoded 1.21 |
| 7 | Pull-quotes import | Laag — offertes importeren |
| 8 | Contact update | Laag — wijzigingen doorvoeren |

