

# Verbeterplan: Werkbonnen, Facturen, Offertes, Rapportages & Planning

Na analyse van de codebase heb ik alle genoemde issues geïdentificeerd. Dit plan beschrijft de fixes en verbeteringen.

---

## Fase 1: Kritieke Bugfixes (Hoogste Prioriteit)

### 1.1 Werkbon URL werkt niet — "Link niet gevonden"
**Probleem**: De `work-order-public` Edge Function crasht omdat deze `createServiceClient` importeert, maar die functie bestaat niet in `_shared/supabase.ts`. De functie heet `createAdminClient`.

**Oplossing**:
- Fix import in `supabase/functions/work-order-public/index.ts` — wijzig `createServiceClient` naar `createAdminClient`

### 1.2 Factuur PDF — Euro-symbool rendering
**Probleem**: In `generate-invoice-pdf/index.ts` staat `\\u20AC` (escaped unicode) i.p.v. `\u20AC` in de `eur()` functie (regel 213), waardoor de PDF letterlijk `\u20AC` toont.

**Oplossing**:
- Fix `eur()` functie in factuur PDF generator

### 1.3 Factuur status niet naar "verzonden" na e-mail
**Probleem**: In `InvoicesPage.tsx` (regel 405-510) wordt bij het versturen van een factuur per e-mail de status niet gewijzigd.

**Oplossing**:
- Na succesvolle e-mailverzending: automatisch `updateInvoice({ id, status: "verzonden" })` aanroepen

---

## Fase 2: Werkbon PDF Verbeteringen

### 2.1 Materialen ontbreken in werkbon PDF
**Probleem**: `generate-workorder-pdf` haalt geen materialen op en toont ze niet.

**Oplossing**:
- Query `work_order_materials` tabel in de edge function
- Toon materialentabel in PDF met naam, aantal, eenheid, eenheidsprijs, totaal
- Toon materialen-totaal apart van dienst-prijs

### 2.2 Foto's ontbreken in werkbon PDF
**Probleem**: Foto's uit de `work_order_photos` tabel worden niet opgehaald/getoond.

**Oplossing**:
- Query foto's via `work_order_photos` tabel
- Genereer signed URLs voor elke foto
- Embed foto's als JPEG in PDF (max 3-4 per pagina, thumbnails)

---

## Fase 3: Werkbon UI Verbeteringen

### 3.1 Materialen uit materialenlijst selecteren
**Status**: Al geïmplementeerd in `WorkOrderMaterials.tsx` — er is al een dropdown met suggesties uit de catalogus.

**Verbetering**: Voeg een "Bladeren" knop toe om de volledige materialenlijst te zien/filteren.

### 3.2 To-do's / Werkzaamheden consistentie
**Probleem**: Als er geen to-do's zijn gekoppeld, moet de UI toch dezelfde checklist-stijl tonen.

**Oplossing**:
- Werkzaamheden-sectie omzetten naar checklistformaat
- Als geen service-taken gekoppeld: mogelijkheid bieden om taken toe te voegen
- Zelfde UI-stijl als bestaande to-do widget

### 3.3 Interne notities (niet zichtbaar voor klant)
**Oplossing**:
- Nieuw veld `internal_notes` toevoegen aan `work_orders` tabel
- Apart "Interne notities" blok in WorkOrderDetailPage met slot-icoon
- Onderscheid van klant-zichtbare opmerkingen

### 3.4 PDF documenten kunnen toevoegen
**Oplossing**:
- Nieuw veld `attachments` (jsonb) in `work_orders`
- Upload naar `work-order-photos` bucket (ondersteunt alle bestandstypen)
- Toon bijlagen in detail-pagina met download-links
- Mogelijkheid om bijlagen te openen/downloaden

---

## Fase 4: Facturen Module Uitbreiding

### 4.1 Factuur detail-pagina (klikbaar openen)
**Probleem**: Facturen kunnen niet worden geopend om te bewerken.

**Oplossing**:
- Maak facturen klikbaar om `InvoiceDialog` te openen in bewerkingsmodus
- InvoiceDialog uitbreiden met:
  - BTW-percentage aanpasbaar per regel
  - Korting-veld (percentage of vast bedrag)
  - Regels toevoegen/verwijderen
  - Concept opslaan zonder te verzenden

### 4.2 Boekhoudkoppeling foutafhandeling
**Probleem**: Boekhoudfouten blokkeren de flow niet maar tonen geen duidelijke feedback.

**Verbetering**: 
- Betere foutmeldingen met specifieke instructies per provider
- Link naar instellingen-pagina om koppeling te controleren

---

## Fase 5: Offertes Module (Basis)
**Huidige staat**: Offertes pagina bestaat maar heeft minimale functionaliteit.

**Verbeteringen voor v1**:
- Offerte-regels bewerken (aantal, prijs, omschrijving)
- Offerte dupliceren
- Offerte naar factuur converteren
- PDF genereren en e-mailen
- Opties: optionele regels die klant kan aan/uitzetten

---

## Fase 6: Rapportages — KPI Berekeningen

**Controleren**:
- Omzet: filteren op `issued_at` of `paid_at` binnen geselecteerde periode
- Werkbonnen: tellen op basis van `created_at` binnen periode
- Gemiddelde orderduur: alleen `afgerond` werkbonnen in periode
- Openstaande facturen: `status != 'betaald'` en `due_at` in periode

**Fix**: Query's aanpassen om consistent de geselecteerde periode te respecteren.

---

## Fase 7: Planning — Full-page Afspraak

**Probleem**: Huidige afspraakdialog is te beperkt voor installatiemonteurs.

**Oplossing**:
- Nieuwe pagina `/planning/new` in plaats van popup
- Object(en) koppelen: multi-select van assets
- Adressen kiezen uit klant-adressen of nieuw ingeven
- Materialen voorbereiden: checklist voor benodigde materialen
- Reistijd weergeven vanaf vorige locatie
- Meerdere monteurs toewijzen

---

## Database Wijzigingen

```sql
-- Interne notities veld voor werkbonnen
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS internal_notes text;

-- Bijlagen veld voor werkbonnen (jsonb array)
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;
```

---

## Prioriteit en Volgorde

| # | Taak | Impact | Complexiteit |
|---|------|--------|--------------|
| 1 | Fix work-order-public import | Kritiek — link werkt niet | Laag |
| 2 | Fix factuur PDF euro-symbool | Kritiek — PDF onleesbaar | Laag |
| 3 | Factuur status naar verzonden na e-mail | Hoog — workflow incorrect | Laag |
| 4 | Materialen in werkbon PDF | Hoog — kosten ontbreken | Gemiddeld |
| 5 | Interne notities veld | Gemiddeld | Gemiddeld |
| 6 | Factuur bewerkbaar maken | Hoog | Gemiddeld |
| 7 | Planning full-page | Hoog | Hoog |

---

## Bestanden die gewijzigd worden

| Bestand | Wijziging |
|---------|-----------|
| `supabase/functions/work-order-public/index.ts` | Fix import |
| `supabase/functions/generate-invoice-pdf/index.ts` | Fix euro-symbool |
| `supabase/functions/generate-workorder-pdf/index.ts` | Materialen + foto's toevoegen |
| `src/pages/InvoicesPage.tsx` | Status naar verzonden na e-mail |
| `src/pages/WorkOrderDetailPage.tsx` | Interne notities, bijlagen, to-do UI |
| `src/components/InvoiceDialog.tsx` | Regels bewerken, korting, BTW |
| Database migration | `internal_notes`, `attachments` kolommen |

