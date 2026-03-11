

# Exact Online Koppeling — Audit & Fixes

## Gevonden problemen

### 1. KRITIEK: Verkeerd GL Account Type filter
**Locatie**: `sync-exact/index.ts` regel 386
**Probleem**: `$filter=Type eq 20` haalt **Debiteuren**-rekeningen op, niet omzetrekeningen.
**Per spec**: Type 20 = Debiteuren, Type **110** = Omzet
**Fix**: Wijzig naar `$filter=Type eq 110`

### 2. `undefined` waarden in Account POST body
**Locatie**: regels 146-157 en 253-264
**Probleem**: Velden als `Email: customer.email || undefined` sturen `undefined` mee in JSON, wat door `JSON.stringify` wordt weggelaten maar rommelig is. Erger: bij PUT (update) kan dit onverwacht gedrag opleveren.
**Fix**: Filter `undefined` waarden uit het body-object voor POST/PUT.

### 3. SalesInvoiceLines — `Item` veld ontbreekt (potentieel probleem)
**Locatie**: regels 460-465, 831-836
**Probleem**: Per spec is `Item` (Edm.Guid) een verplicht veld per SalesInvoiceLine. De code stuurt alleen `Description`, `Quantity`, `NetPrice`, `GLAccount`. Bij Type 8023 (Direct sales invoice) accepteert Exact dit mogelijk zonder Item, maar bij andere types faalt het.
**Impact**: Laag risico zolang Type 8023 wordt gebruikt, maar een duidelijke log/waarschuwing bij falen is nuttig.

### 4. QuotationLines — `Item` veld ontbreekt
**Locatie**: regels 682-686, 892-896
**Probleem**: De POST voorbeelden in de spec tonen `Item` als veld per QuotationLine. De code stuurt alleen `Description`, `Quantity`, `UnitPrice`.
**Impact**: Vergelijkbaar met punt 3 — kan falen afhankelijk van Exact-configuratie.

### 5. Pagination in pull-status haalt ALLE facturen op
**Locatie**: regels 622-625
**Probleem**: `pull-status` haalt alle facturen uit Exact op via `exactGetAll` (onbeperkt paginerend) om een status-lookup te doen. Bij bedrijven met duizenden facturen is dit traag en kan rate limits triggeren.
**Fix**: Filter server-side op alleen openstaande facturen: `$filter=Status ne 50` (niet-betaald).

### 6. `exact-register` hardcoded region "nl"
**Locatie**: `exact-register/index.ts` regel 43
**Probleem**: Region is altijd "nl", maar de spec ondersteunt be/de/co.uk/fr/es.
**Impact**: Laag — werkt voor Nederlandse klanten, maar blokkeert internationale use cases.

## Wat klopt wel
- OAuth flow via extern SiteJob Connect project: correct
- OData v3 pagination via `__next`: correct geïmplementeerd
- Rate limit retry (429 → wacht en retry): correct
- PUT endpoint format `Accounts(guid'{ID}')`: correct per spec
- Account Status "C" voor klanten: correct
- Quotation endpoint `/crm/Quotations`: correct
- SalesInvoice endpoint `/salesinvoice/SalesInvoices`: correct
- Journal code als string: correct
- Pre-check auto-push klanten bij invoice sync: correct

## Implementatieplan

### Bestand: `supabase/functions/sync-exact/index.ts`

1. **Fix GL filter** (regel 386): `Type eq 20` → `Type eq 110`

2. **Clean undefined values** — helper functie toevoegen:
```typescript
function cleanBody(obj: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined));
}
```
Toepassen op alle `exactPost` en `exactPut` calls voor Accounts.

3. **Optimaliseer pull-status** (regel 622-625): voeg filter toe `$filter=Status ne 50` zodat alleen openstaande facturen worden opgehaald.

4. **Betere foutmelding bij Item-gerelateerde fouten**: als een POST faalt met 400, log het specifieke Exact error bericht zodat de gebruiker weet of het door een ontbrekend Item komt.

Totaal: 1 bestand, 4 gerichte fixes.

