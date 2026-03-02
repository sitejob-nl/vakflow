

## Probleem

De Rompslomp API geeft twee fouten:
1. `reference` is geen geldig veld — moet `api_reference` zijn
2. `invoice_lines` is geen geldig veld — moet `lines` zijn
3. `quantity` moet `amount` zijn (per de API docs)

## Wijziging in `supabase/functions/sync-rompslomp/index.ts`

In de **sync-invoices** actie (rond regel 194-205):

```typescript
// Huidige (fout):
invoice_lines: invoiceLines,
reference: inv.invoice_number || undefined,
// met quantity in de line items

// Nieuw (correct per API docs):
lines: invoiceLines,
api_reference: inv.invoice_number || undefined,
// en amount i.p.v. quantity in de line items
```

De line items worden:
```typescript
{
  description: item.description || "Item",
  amount: String(item.qty || 1),        // was: quantity
  price_per_unit: String(...)
}
```

Eén bestand, drie veldnamen corrigeren.

