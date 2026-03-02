

## Plan: Fix Rompslomp factuur import — correcte bedragen en regelitems

### Probleem
Alle uit Rompslomp geïmporteerde facturen hebben `subtotal: 0`, `total: 0`, `items: []`. Dit komt door:
1. **Verkeerde veldnamen** — de code leest `total_without_tax` / `total_with_tax`, maar Rompslomp gebruikt `price_without_vat` / `price_with_vat`
2. **Factuurregels worden niet geïmporteerd** — `invoice_lines` worden genegeerd
3. **Betaalstatus** — code checkt `paid_at` / `state === "paid"`, maar Rompslomp gebruikt `payment_status === "paid"`

### Wijzigingen in `supabase/functions/sync-rompslomp/index.ts`

**pull-invoices actie:**
- Per factuur een individuele GET doen (`/sales_invoices/{id}`) om de `invoice_lines` op te halen (de lijst-endpoint bevat mogelijk niet alle details)
- Bedragen uitlezen met correcte veldnamen: `price_without_vat` → `subtotal`, `price_with_vat` → `total`, `vat_amount`
- `invoice_lines` converteren naar ons `items` jsonb-formaat: `{ description, qty, unit_price, total }` — waarbij `price_per_unit` (excl. BTW) en `quantity` worden overgenomen, en `price_with_vat` per regel als `total` incl.
- Betaalstatus: `payment_status === "paid"` → `status: "betaald"`

**pull-invoice-status actie:**
- Check `payment_status === "paid"` i.p.v. `paid_at` / `state === "paid"`

**sync-invoices actie (push):**
- `price_per_unit` is excl. BTW in Rompslomp. Huidige code stuurt `unit_price` die incl. BTW is → moet gedeeld worden door 1.21 (of het BTW-percentage)

### Bestaande facturen opnieuw pullen
Na de fix kunnen de bestaande facturen (die nu allemaal €0 zijn) opnieuw gesynchroniseerd worden. We passen de pull-invoices actie aan zodat deze ook bestaande facturen met `subtotal = 0` en een `rompslomp_id` opnieuw ophaalt en bijwerkt.

### Bestanden

| Bestand | Actie |
|---|---|
| `supabase/functions/sync-rompslomp/index.ts` | Fix pull-invoices, pull-invoice-status, sync-invoices veldnamen |

