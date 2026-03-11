

# Moneybird Koppeling — Analyse Referentie vs. Vakflow

## Wat Vakflow al heeft (en goed werkt)

De huidige `sync-moneybird/index.ts` is al **zeer uitgebreid** (1063 regels) en ondersteunt:

| Functionaliteit | Status |
|----------------|--------|
| Auto-detect administraties | ✓ |
| Test connection | ✓ |
| Sync/pull contacts (bidirectioneel) | ✓ |
| Sync/pull invoices (bidirectioneel) | ✓ |
| Sync/pull quotes/estimates (bidirectioneel) | ✓ |
| Sync/pull products (bidirectioneel) | ✓ |
| Create single invoice (push) | ✓ |
| Create single quote (push) | ✓ |
| Create subscription (push) | ✓ |
| Pull subscriptions | ✓ |
| Download PDF | ✓ |
| Pull invoice status | ✓ |
| Webhook registration/management | ✓ |
| Multi-tenant (per-company encrypted token) | ✓ |
| Rate limiting | ✓ |

## Wat de referentie extra biedt (en Vakflow mist)

De referentie-bestanden (`index_9.ts`, `index_10.ts`, `Administratie.tsx`) tonen functionaliteit die Vakflow **niet** heeft:

### 1. Directe Moneybird API proxy acties (ontbrekend in sync-moneybird)
- `list_contacts` — zoek/browse Moneybird contacten direct (niet via achtergrond-sync)
- `list_invoices` — browse facturen met state-filter direct uit Moneybird
- `list_products` — browse producten direct
- `create_contact` — maak contact direct in Moneybird (los van Vakflow-klant)
- `update_contact` — wijzig contact direct
- `delete_contact` — verwijder contact
- `create_product` / `update_product` — product CRUD direct
- `list_ledger_accounts` — grootboekrekeningen ophalen
- `list_tax_rates` — BTW-tarieven ophalen
- `financial_summary` — dashboard met openstaand/te laat/betaald totalen
- `send_invoice` — factuur versturen (Moneybird → open + optioneel e-mail)
- `send_reminder` — herinnering versturen met PDF bijlage
- `get_invoice_pdf` — PDF URL ophalen
- `create_standalone_invoice` — factuur aanmaken direct in Moneybird met regels, contact-selectie, datum etc.

### 2. Rich frontend UI (`Administratie.tsx`)
Een complete "Administratie" pagina met tabs:
- **Overzicht**: Financieel dashboard (openstaand, te laat, betaald)
- **Facturen**: Browse, zoek, filter op status, PDF download, versturen, herinnering, betaallink kopiëren, **nieuwe factuur aanmaken met regeleditor**
- **Contacten**: Browse, zoek, detail-view, nieuw contact aanmaken
- **Producten**: Browse, zoek, nieuw product, product bewerken

### 3. Standalone factuur aanmaken (de killer feature)
De referentie heeft een complete **factuur-composer**: contact zoeken, factuurregels toevoegen met product/BTW/grootboek selectie, datum-pickers, en optioneel direct versturen. Dit is de meest waardevolle toevoeging.

## Implementatieplan

### Stap 1: Uitbreiden `sync-moneybird/index.ts` met directe API acties

Toevoegen van de ontbrekende acties aan de bestaande edge function (geen nieuwe functie nodig):
- `list_contacts` (met query/pagination)
- `list_invoices` (met state filter)
- `list_products` (met query)
- `create_contact` / `update_contact` / `delete_contact`
- `create_product` / `update_product`
- `list_ledger_accounts`
- `list_tax_rates`
- `financial_summary` (aggregeer openstaand/te laat/betaald)
- `send_invoice` (send via Manual delivery)
- `send_reminder` (fetch PDF + stuur via e-mail)
- `get_invoice_pdf` (retourneer PDF URL)
- `create_standalone_invoice` (met regels, contact, datums)

### Stap 2: Nieuwe hook `useMoneybirdAdmin.ts`

React hook met:
- `callMoneybirdApi()` wrapper via `supabase.functions.invoke('sync-moneybird')`
- Query hooks voor contacts, invoices, products, ledger accounts, tax rates, financial summary
- Mutation hooks voor CRUD en send/remind acties
- PDF download helper

### Stap 3: Nieuwe pagina/component `MoneybirdAdminPage.tsx`

Gebaseerd op de referentie `Administratie.tsx`, aangepast aan Vakflow's design (geen `glass-premium`, `btn-gold` etc.):
- **Dashboard tab**: Financieel overzicht met statistieken
- **Facturen tab**: Browse + filter + zoek + nieuwe factuur aanmaken (met regeleditor, contact-zoeker, product/BTW/grootboek selectie)
- **Contacten tab**: Browse + zoek + nieuw contact
- **Producten tab**: Browse + zoek + nieuw/bewerk product

### Stap 4: Routing + navigatie

- Nieuwe route `/administratie` of integratie als tab binnen bestaande Settings/Accounting
- Link in navigatie wanneer `accounting_provider === 'moneybird'`

## Bestanden

| Bestand | Actie |
|---------|-------|
| `supabase/functions/sync-moneybird/index.ts` | Uitbreiden met ~15 nieuwe acties |
| `src/hooks/useMoneybirdAdmin.ts` | **Nieuw** — React hooks voor directe Moneybird API |
| `src/components/MoneybirdAdmin.tsx` | **Nieuw** — Volledige admin UI met tabs |
| `src/pages/MoneybirdAdminPage.tsx` | **Nieuw** — Pagina wrapper |
| `src/App.tsx` | Route toevoegen |
| `src/hooks/useNavigation.tsx` | Nav-item toevoegen (conditioneel op provider) |

Geen database-wijzigingen nodig.

