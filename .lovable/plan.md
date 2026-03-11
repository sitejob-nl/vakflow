

# Rompslomp Koppeling — Fixes

## Problemen

### 1. Verkeerde Base URL
**Regel 7**: `https://app.rompslomp.nl/api/v2` bestaat niet.
**Fix**: `https://api.rompslomp.nl/api/v1`

### 2. Fragiele paginering
**Regels 259, 312, 511**: `contacts.length < 100` stopt te vroeg als Rompslomp een lagere default page size hanteert.
**Fix**: `rompslompGet` aanpassen om ook response headers terug te geven, en `X-Total` gebruiken om te bepalen of er meer pagina's zijn.

## Wat klopt
- Per-tenant encrypted token auth: correct voor multi-tenant SaaS
- URL-pad `/companies/${companyId}/...`: correct per spec en referentie
- Contact/invoice/quotation POST wrappers: correct
- PDF download, webhook, config endpoints: correct
- `open_amount` check voor betaalstatus: correct

## Implementatieplan

### Bestand: `supabase/functions/sync-rompslomp/index.ts`

**1. Fix base URL** (regel 7):
```
"https://app.rompslomp.nl/api/v2" → "https://api.rompslomp.nl/api/v1"
```

**2. Refactor `rompslompGet` om headers terug te geven**:
Wijzig return type naar `{ data, headers }` zodat paginatielogica `X-Total` en `X-Per-Page` kan uitlezen.

**3. Update alle paginatie-loops** (pull-contacts, pull-invoices, pull-quotes):
Gebruik `X-Total` header uit de eerste response om het totaal aantal pagina's te berekenen. Fallback naar `length < perPage` als header ontbreekt.

Totaal: 1 bestand, 3 gerichte wijzigingen. Geen database-wijzigingen.

