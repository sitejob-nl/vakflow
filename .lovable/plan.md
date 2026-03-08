

# BTW-code fixes in boekhoudkoppelingen (P1-P2) + Rompslomp pull fix

## Overzicht

3 concrete fixes. P3 (SnelStart mapping), P4 (ROMPSLOMP_BASE) en P5 (auto-sync cron) zijn grotere features/onderzoek — niet in deze batch.

---

## P1: e-Boekhouden vatCode dynamisch

**Bestand:** `supabase/functions/sync-invoice-eboekhouden/index.ts`

`mapInvoiceItems()` krijgt `invoice` al mee. Lees `invoice.vat_percentage` en map:

```
const vatPct = Number(invoice.vat_percentage || 21);
const vatCode = vatPct === 9 ? "LAAG_VERK_9" : vatPct === 0 ? "VRIJ_VERK" : "HOOG_VERK_21";
```

Vervang alle 6 hardcoded `"HOOG_VERK_21"` referenties (regels 115, 127, 567, 576, 1021, 1030) door deze dynamische mapping. De offerte-varianten moeten `quote.vat_percentage` gebruiken i.p.v. `invoice.vat_percentage`.

Helper functie bovenaan:
```typescript
function eboekhoudenVatCode(vatPct: number): string {
  if (vatPct === 0) return "VRIJ_VERK";
  if (vatPct === 9) return "LAAG_VERK_9";
  return "HOOG_VERK_21";
}
```

---

## P2: Rompslomp quote-pull hardcoded 0.21 fixen

**Bestand:** `supabase/functions/sync-rompslomp/index.ts` regel 559

Huidige code:
```typescript
unit_price: Number(line.price_per_unit || 0) * (1 + 0.21),
```

Fix: Rompslomp geeft `vat_percentage` per quote mee, of gebruik de totalen. Pragmatische fix — gebruik `price_with_vat` als die beschikbaar is, anders bereken met de BTW die Rompslomp teruggeeft:

```typescript
unit_price: Number(line.price_with_vat || Number(line.price_per_unit || 0) * 1.21),
```

Of beter: lees het BTW-percentage van de Rompslomp-quote (`rQ.vat_percentage` of bereken uit `total_price_with_vat / total_price_without_vat`).

---

## P4: ROMPSLOMP_BASE constante

**Bestand:** `supabase/functions/sync-rompslomp/index.ts`

Voeg bovenaan toe (na imports, vóór de functie-definities):
```typescript
const ROMPSLOMP_BASE = "https://app.rompslomp.nl/api/v2";
```

Rompslomp API v2 base URL. Zonder deze constante crasht elke Rompslomp API call met een ReferenceError.

---

## Bestandsoverzicht

| Bestand | Wijziging |
|---|---|
| `supabase/functions/sync-invoice-eboekhouden/index.ts` | Helper `eboekhoudenVatCode()`, vervang 6× hardcoded vatCode |
| `supabase/functions/sync-rompslomp/index.ts` | ROMPSLOMP_BASE constante + fix hardcoded 0.21 op regel 559 |

Geen database-wijzigingen nodig. Beide edge functions worden automatisch gedeployed.

