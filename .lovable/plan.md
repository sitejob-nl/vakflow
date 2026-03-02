

## Probleem

De Rompslomp API geeft fout: `"Unpermitted parameter: lines."` De Swagger YAML (de echte bron) bevestigt:

- Veld moet **`invoice_lines`** zijn, niet `lines`
- Hoeveelheid moet **`quantity`** zijn, niet `amount`

De eerder aangeleverde API-documentatie was onjuist op deze punten.

## Wijzigingen in `supabase/functions/sync-rompslomp/index.ts`

### 1. sync-invoices actie

Verander de invoice line items van `amount` terug naar `quantity`, en het container-veld van `lines` naar `invoice_lines`:

```typescript
// Line items:
{ description: ..., quantity: String(item.qty || 1), price_per_unit: ... }

// Invoice data:
{ contact_id: ..., date: ..., invoice_lines: invoiceLines, api_reference: ... }
```

### 2. sync-quotes actie

Zelfde fix: `lines` → `invoice_lines`, `amount` → `quantity`

### 3. pull-invoices actie

Bij het lezen van factuurregels: `quantity` i.p.v. `amount`

Eén bestand, drie plekken corrigeren. Daarna deployen.

