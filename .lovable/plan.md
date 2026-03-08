

## Plan: Bugfixes + Materialen opslagberekening

Dit plan bevat 3 bugfixes en 1 feature. De blok-gebaseerde document/offerte-editor bestaat al (`QuoteTemplateBuilder.tsx`), dus die hoeft niet opnieuw gebouwd te worden.

---

### Bug 1: Facturen/E-mail tabs verwisseld in klantdetail

**Probleem:** In `CustomerDetailPage.tsx`, de `tabLabels` array heeft "Facturen" op index 1 en "E-mail" op index 2, maar de `tabContent` array heeft ze omgedraaid — E-mail op index 1, Facturen op index 2.

**Fix:** Verwissel de volgorde in `tabContent` zodat index 1 = Facturen en index 2 = E-mail (CustomerEmailTab).

**Bestand:** `src/pages/CustomerDetailPage.tsx` regels 108-160

---

### Bug 2: Raw HTML in e-mail previews (CustomerEmailTab)

**Probleem:** In `CustomerEmailTab.tsx` regel 204, e-mail body wordt getoond met `{m.body}` als platte tekst. Wanneer `body` HTML bevat, wordt ruwe HTML getoond. De `EmailPage` heeft al een `HtmlEmailViewer` iframe component die dit correct afhandelt.

**Fix:**
- In `CustomerEmailTab.tsx`: check of `m.html_body` of `m.body` HTML bevat (begint met `<` of bevat `<html`). Zo ja, toon een samenvatting door HTML tags te strippen, of gebruik een compacte iframe preview.
- Extraheer een helper `stripHtml(text)` die tags verwijdert voor de preview in de lijst.

**Bestand:** `src/components/CustomerEmailTab.tsx`

---

### Bug 3: Factuur zonder nummer

**Probleem:** Er staat een factuur met alleen "—" als nummer. De `generate_invoice_number` trigger zou dit moeten voorkomen, maar deze factuur is mogelijk aangemaakt voordat de trigger bestond of via een directe insert.

**Fix:** Dit is data-gerelateerd, geen code-bug. Ik zal in de UI een fallback tonen die "Concept" toont in plaats van "—" wanneer er geen factuurnummer is, en een visuele indicator toevoegen.

**Bestand:** `src/pages/InvoicesPage.tsx` — fallback tekst voor lege `invoice_number`

---

### Bug 4: Werkbonnen per status grafiek leeg in Rapportages

**Probleem:** De pie chart in `ReportsPage.tsx` toont alleen statussen "open", "bezig", "afgerond" (regel 16-26). Als werkbonnen andere statussen hebben, worden ze niet gekleurd of gelabeld maar wel meegerekend.

**Fix:** Voeg alle mogelijke statussen toe aan `STATUS_COLORS` en `STATUS_LABELS` (bijv. "ingepland", "onderweg", etc.) en verifieer dat de data correct wordt doorgegeven vanuit `useReportData`.

**Bestand:** `src/pages/ReportsPage.tsx`

---

### Feature: Materialen met opslagberekening

**Doel:** Zoals Plancraft: Inkoopprijs + Opslag% = automatische Verkoopprijs.

**Database migratie:**
```sql
ALTER TABLE materials
  ADD COLUMN cost_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN markup_percentage numeric NOT NULL DEFAULT 0;
```
De bestaande `unit_price` wordt de verkoopprijs (= cost_price * (1 + markup_percentage/100)).

**UI wijzigingen in `MaterialsSettings.tsx`:**
- Voeg kolommen "Inkoopprijs" en "Opslag %" toe aan de tabel
- Bij invoer: gebruiker vult inkoopprijs en opslag% in, verkoopprijs wordt automatisch berekend
- Verkoopprijs veld wordt read-only wanneer opslag actief is, of handmatig overschrijfbaar

**Hook wijzigingen in `useMaterials.ts`:**
- Voeg `cost_price` en `markup_percentage` toe aan de `Material` interface
- Bereken `unit_price` automatisch bij create/update als markup wordt gebruikt

**Bestanden:**
- Supabase migratie (2 kolommen toevoegen)
- `src/hooks/useMaterials.ts`
- `src/components/MaterialsSettings.tsx`

---

### Niet nodig: Blok-gebaseerde offerte-editor

De `QuoteTemplateBuilder.tsx` met blok-types (item_group, heading, text, divider, optional_group) en `QuoteTemplatePreview.tsx` bestaan al. Dit is al geïmplementeerd.

---

### Samenvatting wijzigingen

| Taak | Bestanden | Type |
|------|-----------|------|
| Tab swap fix | CustomerDetailPage.tsx | Bug |
| HTML email preview | CustomerEmailTab.tsx | Bug |
| Factuur nummer fallback | InvoicesPage.tsx | Bug |
| Status labels rapportage | ReportsPage.tsx | Bug |
| Materialen opslag | migratie + useMaterials.ts + MaterialsSettings.tsx | Feature |

