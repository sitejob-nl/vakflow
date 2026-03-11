

# Audit: e-Boekhouden koppeling

## Gevonden problemen

### 1. Verkeerde BTW-code voor 0%
**Locatie**: regel 13
**Probleem**: `VRIJ_VERK` bestaat niet in de API spec. De juiste code voor 0% verkoop is `GEEN`.
**Fix**: `return "GEEN"`

### 2. Source naam "VentFlow" in sessie
**Locatie**: regel 68
**Probleem**: Product heet "Vakflow", niet "VentFlow".
**Fix**: `source = "Vakflow"`

### 3. Outstanding invoices mist `type=debtors` parameter
**Locatie**: regel 913
**Probleem**: Per spec is `/mutation/invoice/outstanding?type=debtors` vereist. Code stuurt geen `type` mee.
**Fix**: Voeg `&type=debtors` toe aan de query.

### 4. pull-contacts haalt elke relatie individueel op (N+1)
**Locatie**: regels 768-803
**Probleem**: Na het ophalen van alle relaties via `GET /relation?limit=2000`, wordt voor elke relatie nog een individuele `GET /relation/{id}` gedaan. De list-response bevat al alle velden — de extra calls zijn onnodig en veroorzaken honderden extra API-calls.
**Fix**: Gebruik de data uit de list-response direct (die bevat `name`, `address`, `postalCode`, `city`, `emailAddress`, `phoneNumber`). Verwijder de individuele fetch.

### 5. pull-invoice-status doet onnodige individuele fetches
**Locatie**: regels 929-953
**Probleem**: Zelfs als de outstanding-lijst succesvol is opgehaald, wordt voor elke onbetaalde factuur alsnog een individuele `GET /invoice/{id}` gedaan om het factuurnummer te vergelijken. Dit is N+1 overhead.
**Fix**: Vergelijk op `eboekhouden_id` in plaats van `invoiceNumber`. Als de factuur NIET in de outstanding lijst staat → markeer als betaald. Skip de individuele fetch.

### 6. Auto-sync pull-contacts heeft hetzelfde N+1 probleem
**Locatie**: regels 208-229
**Probleem**: Zelfde als punt 4, maar in de cron auto-sync context.
**Fix**: Verwijder de individuele `ebGet(sess, `/relation/${rel.id}`)` call, gebruik `rel` direct.

## Wat klopt
- Base URL `https://api.e-boekhouden.nl/v1`: correct
- Session POST met `accessToken` + `source`: correct
- Authorization header met session token (zonder "Bearer"): correct
- Pagination met `limit` en `offset`: correct
- `POST /v1/invoice` met `relationId`, `templateId`, `items`: correct
- `PATCH /v1/relation/{id}` voor updates: correct
- `inExVat: "IN"` voor inclusief-BTW prijzen: correct
- `mutation.ledgerId` voor debiteurenrekening: correct
- Rate limiting: correct

## Implementatieplan

### Bestand: `supabase/functions/sync-invoice-eboekhouden/index.ts`

1. **Fix BTW-code** (regel 13): `"VRIJ_VERK"` → `"GEEN"`
2. **Fix source** (regel 68): `"VentFlow"` → `"Vakflow"`
3. **Fix outstanding query** (regel 913): voeg `&type=debtors` toe
4. **Elimineer N+1 in pull-contacts** (regels 768-803): gebruik list-data direct i.p.v. individuele fetches
5. **Elimineer N+1 in auto-sync pull-contacts** (regels 208-229): idem
6. **Optimaliseer pull-invoice-status** (regels 929-953): vergelijk op ID i.p.v. individueel ophalen; sla `paymentDate` als `now()` op als niet beschikbaar

Totaal: 1 bestand, 6 gerichte fixes.

