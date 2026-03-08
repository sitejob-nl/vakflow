

# CleanFlow Fase 3 & 4 — Contractfacturatie, Seizoensdiensten, Materiaalverbruik & Rapportages

## Samenvatting

Fase 3 breidt de bestaande contracten-module uit met cleaning-specifieke features: koppeling aan objecten met seizoensdiensten, automatische periodefacturatie vanuit contracten, en cleaning-specifieke offertes. Fase 4 voegt materiaalverbruik per werkbon/object toe aan rapportages en bouwt een CleanFlow-rapportagetab.

---

## Fase 3 — Contractfacturatie & Seizoensdiensten

### 3A. Contracten uitbreiden voor cleaning

De `contracts` tabel heeft al `asset_id`, `service_id`, `interval_months`, `price`, en `next_due_date`. Wat ontbreekt:

**Database migratie:**
```sql
ALTER TABLE contracts ADD COLUMN seasonal_months integer[] DEFAULT NULL;
-- Bijv. {4,5,6,7,8,9} = april t/m september
-- NULL = jaarrond
ALTER TABLE contracts ADD COLUMN frequency text DEFAULT NULL;
-- Bijv. 'weekly', '2x_week' — schoonmaakfrequentie binnen het contract
ALTER TABLE contracts ADD COLUMN auto_invoice boolean DEFAULT false;
-- Automatisch factureren bij werkbon-generatie
```

**ContractDialog.tsx uitbreiden:**
- Nieuw veld: "Seizoensdienst" toggle + maanden-selector (multi-select checkboxes jan-dec)
- Nieuw veld: "Schoonmaakfrequentie" dropdown (alleen voor cleaning industry)
- Nieuw veld: "Automatisch factureren" switch
- Object-koppeling combobox (al beschikbaar via `asset_id` op contracts tabel)

**contract-generate edge function aanpassen:**
- Check `seasonal_months`: skip werkbon-generatie als huidige maand niet in array zit
- Bij `auto_invoice = true`: maak naast werkbon ook een concept-factuur aan

### 3B. Cleaning-specifieke offertes

De offertes-module (QuotesPage, QuoteDialog) is al generiek gebouwd. Uitbreiding:

**Database migratie:**
```sql
ALTER TABLE quotes ADD COLUMN asset_id uuid REFERENCES assets(id) ON DELETE SET NULL;
ALTER TABLE quotes ADD COLUMN contract_id uuid REFERENCES contracts(id) ON DELETE SET NULL;
```

**QuoteDialog.tsx uitbreiden:**
- Object-koppeling (asset_id) — alleen zichtbaar voor cleaning
- Mogelijkheid om offerte om te zetten naar contract (knop "Omzetten naar contract" op geaccepteerde offertes)

**Nieuwe functie in useQuotes.ts:**
- `useConvertQuoteToContract()` — maakt een contract aan op basis van offerte-gegevens (klant, object, prijs, items)

---

## Fase 4 — Materiaalverbruik & CleanFlow Rapportages

### 4A. Materiaalverbruik per object

Materiaalverbruik zit al op werkbonnen (`work_order_materials`). Wat ontbreekt is aggregatie per object.

**useCleaningReports.ts (nieuw):**
- Query: `work_order_materials` JOIN `work_orders` WHERE `work_orders.asset_id` is not null, gegroepeerd per asset
- Resultaat: materiaalverbruik per object per maand (naam, totaalkosten, hoeveelheden)
- Vergelijking met contractbudget indien contract gekoppeld

### 4B. CleanFlow Rapportagetab

**ReportsPage.tsx uitbreiden:**
- Nieuwe tab "Schoonmaak" (naast "Algemeen"), alleen voor cleaning industry
- Inhoud van de tab:

| KPI | Bron |
|---|---|
| Actieve contracten & totale contractwaarde | contracts tabel |
| Frequentie-naleving gem. % | Hergebruik FrequencyComplianceReport logica |
| Gem. kwaliteitsscore (trend) | assets.avg_quality_score |
| Materiaalverbruik per object (top 10) | work_order_materials via work_orders.asset_id |
| Omzet per object | invoices via work_orders.asset_id |

**Charts:**
- Barchart: materiaalkosten per object (top 10)
- Lijndiagram: kwaliteitsscore-trend per maand (uit quality_audits)
- Tabel: contracten met nalevings% en kwaliteitsscore per object

### 4C. Materiaalverbruik op AssetsPage detail

**AssetsPage.tsx detail sheet uitbreiden:**
- Sectie "Materiaalverbruik": totaal materiaalkosten afgelopen 3 maanden
- Link naar volledige rapportage

---

## Bestandsoverzicht

| Bestand | Actie |
|---|---|
| Migratie SQL | `seasonal_months`, `frequency`, `auto_invoice` op contracts; `asset_id`, `contract_id` op quotes |
| `src/components/ContractDialog.tsx` | Seizoens-selector, frequentie, auto-invoice toggle, object-koppeling |
| `supabase/functions/contract-generate/index.ts` | Seizoensfilter, auto-facturatie |
| `src/components/QuoteDialog.tsx` | Object-koppeling, "Omzetten naar contract" knop |
| `src/hooks/useQuotes.ts` | `useConvertQuoteToContract()` mutation |
| `src/hooks/useCleaningReports.ts` | Nieuw: materiaalverbruik per object, kwaliteitstrend |
| `src/pages/ReportsPage.tsx` | CleanFlow rapportagetab |
| `src/pages/AssetsPage.tsx` | Materiaalverbruik sectie in detail |
| `src/config/industryConfig.ts` | Geen wijziging nodig (contracts al in modules) |

---

## Volgorde van implementatie

1. Database migratie (contracts + quotes kolommen)
2. ContractDialog uitbreiden (seizoensdiensten, frequentie, auto-invoice)
3. contract-generate edge function aanpassen
4. QuoteDialog object-koppeling + offerte-naar-contract conversie
5. useCleaningReports hook bouwen
6. ReportsPage CleanFlow tab
7. AssetsPage materiaalverbruik sectie

