

## Plan: Moneybird Edge Function corrigeren op basis van API schema's

Na vergelijking van de huidige `sync-moneybird` implementatie met de officiële schema's zijn er een paar correcties nodig:

### Wijzigingen in `supabase/functions/sync-moneybird/index.ts`

**1. PDF download pad corrigeren**
Het huidige pad `sales_invoices/${moneybird_id}/download_pdf.json` is incorrect — het endpoint retourneert binary PDF, niet JSON. Moet worden: `sales_invoices/${moneybird_id}/download_pdf`.

**2. Veldnamen in `pull-invoices` corrigeren**
De huidige code gebruikt `total_price_incl_tax_with_discount` en `total_price_excl_tax_with_discount`, maar het Moneybird schema gebruikt:
- `total_price_incl_tax`
- `total_price_excl_tax`

Zelfde voor detail regels: `total_price_excl_tax_with_discount` bestaat niet op detail-niveau, de correcte velden zijn `price` en `total_price_excl_tax_with_discount` → gewoon `price` * `amount`.

**3. Veldnamen in `pull-quotes` corrigeren**
Zelfde probleem als bij invoices — de estimate response gebruikt `total_price_incl_tax` / `total_price_excl_tax`, niet de `_with_discount` variant.

**4. Tax rate in pull-quotes hardcoded**
De huidige code doet `Number(d.price || 0) * 1.21` — dit zou de `tax_rate_id` moeten respecteren. Aangezien we het BTW-percentage niet altijd kennen vanuit Moneybird detail, houden we het eenvoudig maar gebruiken we de totaal velden van het estimate zelf.

### Bestanden

| Bestand | Wijziging |
|---------|-----------|
| `supabase/functions/sync-moneybird/index.ts` | Correcte veldnamen + PDF pad fix |

