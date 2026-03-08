

# Exact Online Sync — Fixes voor 6 problemen

## Overzicht

Er zijn 6 problemen geïdentificeerd in de sync-exact Edge Function. Hieronder de aanpak per probleem, geordend op prioriteit.

---

## Probleem 1 — Factuurregels zonder GLAccount (MEDIUM)

**Huidige situatie:** Factuurregels worden gestuurd met alleen `Description`, `Quantity`, `NetPrice`. De hardcoded `Journal: "70"` werkt niet voor elk bedrijf.

**Fix:**
- Kolom `journal_code` toevoegen aan `exact_config` (default `"70"`)
- In sync-exact de hardcoded `"70"` vervangen door `config.journal_code || "70"`
- GLAccount/Item niet toevoegen — Type 8023 werkt zonder bij standaard Exact configuraties. Een toekomstige uitbreiding kan een `default_gl_account` veld toevoegen.

---

## Probleem 2 — VATNumber en ChamberOfCommerce ontbreken (MEDIUM)

**Huidige situatie:** Bij push van klanten naar Exact worden `btw_number` en `kvk_number` niet meegestuurd, terwijl die wel op de `customers` tabel staan (via de `companies` tabel, maar klant-specifieke waarden ontbreken).

**Fix:**
- In `sync-contacts` en `ensureExactAccount`: customer `kvk_number` en `btw_number` meesturen als `ChamberOfCommerce` en `VATNumber`.
- Probleem: de `customers` tabel heeft geen `kvk_number` of `btw_number` kolommen. Alleen `companies` heeft die. Voor zakelijke klanten (`type = 'zakelijk'`) zou dit relevant zijn.
- **Aanpak:** Twee kolommen toevoegen aan `customers`: `kvk_number` en `btw_number`. Dan meesturen in de Exact Account push.

---

## Probleem 3 — Offerte-sync slaat exact_id niet op (MEDIUM)

**Huidige situatie:** De `quotes` tabel heeft geen `exact_id` kolom. Bij sync worden offertes telkens opnieuw gepusht — geen deduplicatie.

**Fix:**
- Kolom `exact_id text` toevoegen aan `quotes` tabel
- In `sync-quotes` (regel 648-652): na succesvolle push het `QuotationID` opslaan
- In `create-quote` (regel 844-847): idem
- Filter `.is("exact_id", null)` toevoegen aan sync-quotes query (zoals bij sync-invoices)

---

## Probleem 4 — pull-invoices status mapping (LAAG)

**Huidige situatie:** Status is al `"verzonden"` op regel 505. Dit is correct.

**Fix:** Geen actie nodig — al gefixt.

---

## Probleem 5 — Geen product-sync (INFO)

Geen actie in deze batch. Kan later worden toegevoegd als feature request.

---

## Probleem 6 — Geen webhook-registratie (INFO)

Geen actie in deze batch. De `exact-webhook` endpoint bestaat al maar wordt niet actief geregistreerd.

---

## Technisch plan

### Migratie (1 SQL bestand)

```sql
-- 1. exact_id op quotes
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS exact_id text;

-- 2. journal_code op exact_config
ALTER TABLE exact_config ADD COLUMN IF NOT EXISTS journal_code text DEFAULT '70';

-- 3. kvk_number en btw_number op customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS kvk_number text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS btw_number text;
```

### Edge Function: sync-exact/index.ts

| Locatie | Wijziging |
|---|---|
| `ensureExactAccount` (regel 146-155) | `ChamberOfCommerce` en `VATNumber` toevoegen |
| `sync-contacts` push (regel 251-259) | Idem |
| `sync-contacts` update (regel 289-295) | Idem |
| `sync-invoices` (regel 412) | `Journal: config.journal_code \|\| "70"` |
| `create-invoice` (regel 769) | Idem |
| `sync-quotes` (regel 602) | Filter `.is("exact_id", null)` toevoegen |
| `sync-quotes` (regel 648-652) | `exact_id` opslaan na push |
| `create-quote` (regel 844-847) | `exact_id` opslaan na push |

### Frontend types

De types worden automatisch bijgewerkt na migratie (Supabase type gen).

---

## Samenvatting acties

1. **Migratie**: 3 schema-wijzigingen (quotes.exact_id, exact_config.journal_code, customers.kvk_number/btw_number)
2. **Edge Function**: 8 wijzigingen in sync-exact/index.ts
3. **Geen frontend-wijzigingen nodig** — de nieuwe kolommen worden alleen door de Edge Function gebruikt
4. **Herimplementatie** van de Edge Function

