

## Plan: Moneybird koppeling

De Moneybird-integratie wordt gebouwd naar hetzelfde patroon als de bestaande Rompslomp-koppeling: een edge function voor alle API-communicatie, database-velden voor de koppeling, en frontend-integratie voor auto-sync bij factuuraanmaak + PDF download.

### Database migratie

Nieuwe kolommen op de `companies` tabel:
- `moneybird_api_token` (text, nullable)
- `moneybird_administration_id` (text, nullable)

Nieuwe kolom op `customers`:
- `moneybird_contact_id` (text, nullable)

Nieuwe kolom op `invoices`:
- `moneybird_id` (text, nullable)

Nieuwe kolom op `quotes`:
- `moneybird_id` (text, nullable)

### Edge Function: `supabase/functions/sync-moneybird/index.ts`

Zelfde structuur als `sync-rompslomp`. Base URL: `https://moneybird.com/api/v2/{administration_id}/`. Acties:

| Actie | Wat het doet |
|-------|-------------|
| `auto-detect` | GET `/administrations` → lijst administraties teruggeven |
| `test` | GET `/contacts?per_page=1` → verbinding testen |
| `sync-contacts` | Push klanten zonder `moneybird_contact_id` naar Moneybird (`POST /contacts`) |
| `pull-contacts` | Haal contacten op en importeer/update in Vakflow |
| `sync-invoices` | Push facturen zonder `moneybird_id` naar Moneybird (`POST /sales_invoices`) |
| `pull-invoices` | Haal facturen op en importeer in Vakflow |
| `pull-invoice-status` | Check betaalstatus van openstaande facturen |
| `create-invoice` | Push één factuur, haal factuurnummer terug, update Vakflow |
| `download-pdf` | GET `/sales_invoices/{id}/download_pdf` → PDF binary terug |
| `sync-quotes` | Push offertes naar Moneybird estimates (`POST /estimates`) |
| `pull-quotes` | Haal estimates op en importeer |

Moneybird-specifieke mapping:
- Contact: `company_name`, `firstname`/`lastname`, `email`, `phone`, `address1`, `zipcode`, `city`
- Sales Invoice: `contact_id`, `invoice_date`, `details_attributes` (array met `description`, `amount`, `price`)
- Estimate: `contact_id`, `estimate_date`, `details_attributes`
- Publiceren: `PATCH /sales_invoices/{id}/send_invoice` (of `state: "open"` bij create)

### Config: `supabase/config.toml`

```toml
[functions.sync-moneybird]
verify_jwt = false
```

### Frontend: `src/hooks/useInvoices.ts`

Moneybird sync hooks toevoegen (zelfde patroon als Rompslomp hooks):
- `useSyncContactsMoneybird`, `usePullContactsMoneybird`
- `useSyncInvoicesMoneybird`, `usePullInvoicesMoneybird`, `usePullInvoiceStatusMoneybird`
- `useSyncQuotesMoneybird`, `usePullQuotesMoneybird`

### Frontend: `src/components/InvoiceDialog.tsx`

Naast de bestaande Rompslomp check, ook `accountingProvider === "moneybird"` afhandelen met `sync-moneybird` → `create-invoice`.

### Frontend: `src/pages/InvoicesPage.tsx`

PDF-knop logica uitbreiden: als `moneybird_id` bestaat en provider is moneybird, gebruik de Moneybird PDF download via edge function.

### Frontend: `src/pages/SettingsPage.tsx`

Vervang de "binnenkort beschikbaar" placeholder door een volledig Moneybird configuratiepaneel (zelfde UI als Rompslomp):
- API token invoer
- Auto-detect administraties
- Sync/pull knoppen voor contacten, facturen, offertes, betaalstatus

### Bestanden

| Bestand | Wijziging |
|---------|-----------|
| DB migratie | `moneybird_*` kolommen op companies, customers, invoices, quotes |
| `supabase/functions/sync-moneybird/index.ts` | Nieuwe edge function |
| `supabase/config.toml` | JWT config voor sync-moneybird |
| `src/hooks/useInvoices.ts` | Moneybird sync hooks |
| `src/components/InvoiceDialog.tsx` | Auto-sync naar Moneybird |
| `src/pages/InvoicesPage.tsx` | Moneybird PDF download |
| `src/pages/SettingsPage.tsx` | Moneybird configuratie UI |

