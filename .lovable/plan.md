

# Offerte-conversieflow — 3 gaps dichten

## Overzicht

Voeg drie ontbrekende conversies toe aan de offerteketen: offerte → werkbon, offerte → factuur, offerte → afspraak.

## 1. Database migratie

```sql
ALTER TABLE work_orders ADD COLUMN quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_work_orders_quote_id ON work_orders(quote_id);
CREATE INDEX IF NOT EXISTS idx_invoices_quote_id ON invoices(quote_id);
```

## 2. Hooks — `src/hooks/useQuotes.ts`

Twee nieuwe mutation hooks naast bestaande `useConvertQuoteToContract`:

- **`useConvertQuoteToWorkOrder`** — insert work_order met `quote_id`, voegt items toe als `work_order_materials`, zet offerte op `geaccepteerd`
- **`useConvertQuoteToInvoice`** — insert invoice met `quote_id`, berekent subtotal/vat/total dynamisch op basis van `vat_percentage`, zet offerte op `geaccepteerd`

## 3. QuoteDialog — `src/components/QuoteDialog.tsx`

Drie extra knoppen naast bestaande "Omzetten naar contract" (alleen bij status `geaccepteerd`):
- **Werkbon aanmaken** — roept `useConvertQuoteToWorkOrder` aan, toont toast, sluit dialog
- **Factuur aanmaken** — roept `useConvertQuoteToInvoice` aan, toont toast, sluit dialog
- **Afspraak inplannen** — roept nieuwe callback `onScheduleAppointment(quote)` aan, sluit dialog

Nieuwe prop: `onScheduleAppointment?: (quote: Quote) => void`

## 4. QuotesPage — `src/pages/QuotesPage.tsx`

- Import `AppointmentDialog`, `useConvertQuoteToWorkOrder`, `useConvertQuoteToInvoice`
- State: `appointmentDialogOpen`, `appointmentPrefill`
- `handleScheduleAppointment(quote)` — zet prefill (customer_id, notes uit items) en opent AppointmentDialog
- Doorgeven als prop aan QuoteDialog: `onScheduleAppointment={handleScheduleAppointment}`
- In QuotePreview bij `geaccepteerd` status: drie actieknoppen (Werkbon, Factuur, Afspraak)
- Render `<AppointmentDialog>` met prefill

## 5. AppointmentDialog — `src/components/AppointmentDialog.tsx`

- Nieuwe optionele prop: `prefill?: { customer_id?: string; notes?: string }`
- In het form-init useEffect (regel 180-194, de `else` branch voor nieuwe afspraken): als `prefill` bestaat, zet `customer_id` en `notes` vanuit prefill

## Bestanden

| Bestand | Wijziging |
|---|---|
| SQL migratie | `quote_id` kolom op work_orders + invoices, 2 indexen |
| `src/hooks/useQuotes.ts` | `useConvertQuoteToWorkOrder`, `useConvertQuoteToInvoice` |
| `src/components/QuoteDialog.tsx` | 3 conversieknoppen + `onScheduleAppointment` prop |
| `src/pages/QuotesPage.tsx` | AppointmentDialog integratie + 3 actieknoppen in preview |
| `src/components/AppointmentDialog.tsx` | `prefill` prop |

## Volgorde

1. Database migratie
2. Hooks
3. AppointmentDialog prefill prop
4. QuoteDialog knoppen
5. QuotesPage integratie

