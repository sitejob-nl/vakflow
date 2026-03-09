
# Uitgebreide Administratie/Facturen Module per Boekhoudkoppeling

## Huidige Situatie

De facturen-module is nu een generieke lijst met basis CRUD-functionaliteit. Er zijn al **6 boekhoudproviders** geïmplementeerd met uitgebreide Edge Functions:
- **Exact Online**: sync-contacts, pull-contacts, sync-invoices, pull-invoices, pull-invoice-status, sync-quotes, pull-quotes, pull-payments
- **Moneybird**: sync-contacts, pull-contacts, sync-invoices, pull-invoices, pull-invoice-status, sync-quotes, pull-quotes, sync-products, pull-products, pull-subscriptions
- **Rompslomp**: sync-contacts, pull-contacts, sync-invoices, pull-invoices, pull-invoice-status, sync-quotes, pull-quotes, get-pdf
- **WeFact**: sync-contacts, pull-contacts, sync-invoices, pull-invoices, pull-invoice-status, sync-products, pull-products
- **e-Boekhouden**: sync, sync-all-contacts, sync-all-invoices, pull-contacts, pull-invoices, pull-invoice-status
- **SnelStart**: artikelen, relaties, facturen, offertes, verkooporders

Deze endpoints worden nauwelijks benut in de UI!

---

## Oplossing: Provider-specifieke Administratiemodule

### Architectuur

```text
InvoicesPage.tsx
├── NoProviderView (standaard facturenlijst)
└── ProviderAdminModule (dynamisch per provider)
    ├── EboekhoudenModule
    ├── MoneybirdModule
    ├── RompslompModule
    ├── WefactModule
    ├── ExactModule
    └── SnelstartModule
```

### 1. Facturenlijst uitbreiden
- **Factuur klikbaar openen** → detail-sheet of fullscreen dialog
- **Per-regel BTW** aanpasbaar (0/9/21%)
- **Korting** per regel of op totaal (% of vast bedrag)
- **Bijwerken bestaande factuur** met alle velden

### 2. Provider-specifieke actiepaneel
Per gekoppelde provider tonen we een "Sync Center" met alle beschikbare acties:

| Provider | Beschikbare acties in UI |
|----------|--------------------------|
| Exact | Pull/sync contacten, Pull/sync facturen, Pull betalingen, Pull/sync offertes |
| Moneybird | Pull/sync contacten, Pull/sync facturen, Pull status, Pull producten, Pull abonnementen |
| Rompslomp | Pull/sync contacten, Pull/sync facturen, Pull/sync offertes, Download PDF's |
| WeFact | Pull/sync debiteuren, Pull/sync facturen, Pull producten |
| e-Boekhouden | Full sync contacten/facturen, Pull status |
| SnelStart | Sync artikelen, relaties, facturen |

### 3. Detail-paneel per factuur
Als een factuur een provider-ID heeft (exact_id, moneybird_id, etc.):
- Toon **provider status** (betaald/openstaand)
- Knop: **Open in [Provider]** (externe link)
- Knop: **Pull status** (haal actuele betaalstatus op)
- Bij Rompslomp/Moneybird: **Download PDF** vanuit provider

### 4. Korting & BTW per regel
Huidige factuurregels:
```typescript
{ description, qty, unit_price, total }
```
Uitbreiden naar:
```typescript
{ description, qty, unit_price, vat_percentage, discount, discount_type, total }
```
Met discount_type: 'percentage' | 'fixed'

---

## Implementatieplan

### Fase 1: InvoiceDetailSheet (core)
- Nieuw component: `InvoiceDetailSheet.tsx`
- Volledig factuuroverzicht met bewerkingsmodus
- BTW per regel selector
- Korting per regel of op totaal
- Provider status badge + link

### Fase 2: ProviderSyncPanel component
- Dynamisch panel dat beschikbare acties toont per provider
- Alle hooks uit `useInvoices.ts` al beschikbaar
- Progress indicators voor bulk sync operaties

### Fase 3: InvoicesPage refactor
- Master-detail layout (lijst links, detail rechts)
- Provider sync-panel in header of sidebar
- Bulk acties: "Sync alle openstaande naar [Provider]"

### Fase 4: Provider-specifieke features
- **Moneybird**: Import recurring invoices (subscriptions)
- **Exact**: View payment history
- **Rompslomp**: Download & attach provider PDF
- **WeFact**: Product catalog sync

---

## Database wijzigingen

```sql
-- Uitbreiding factuurregels voor korting
-- Geen schema-wijziging nodig: items is al JSONB
-- Nieuwe properties in items[]: vat_percentage, discount, discount_type
```

---

## Bestanden

| Bestand | Wijziging |
|---------|-----------|
| `src/components/InvoiceDetailSheet.tsx` | **Nieuw** - volledige factuur detail/bewerk view |
| `src/components/ProviderSyncPanel.tsx` | **Nieuw** - provider-specifieke acties |
| `src/pages/InvoicesPage.tsx` | Refactor naar master-detail + provider panel |
| `src/components/InvoiceDialog.tsx` | BTW per regel, korting velden |
| `src/hooks/useInvoices.ts` | Eventuele nieuwe hooks voor provider-specifieke calls |

---

## Prioriteit

1. **InvoiceDetailSheet** met provider-aware status — Hoog
2. **BTW per regel + korting** in InvoiceDialog — Hoog
3. **ProviderSyncPanel** met alle beschikbare acties — Gemiddeld
4. **Provider-specifieke features** (PDF download, etc.) — Laag

