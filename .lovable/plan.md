

## Plan: Contracten module

Een nieuwe module voor terugkerende servicecontracten met automatische werkbon-generatie. Klanten krijgen contracten toegewezen die periodiek werkbonnen aanmaken.

---

### 1. Database

**Nieuwe tabel: `contracts`**

| Kolom | Type | Beschrijving |
|-------|------|-------------|
| id | uuid PK | |
| company_id | uuid | Multi-tenant isolatie |
| customer_id | uuid | Gekoppelde klant |
| service_id | uuid | Dienst die uitgevoerd wordt |
| address_id | uuid | Werkadres (optioneel) |
| asset_id | uuid | Gekoppeld object (optioneel) |
| name | text | Contractnaam |
| description | text | Omschrijving werkzaamheden |
| status | text | `actief`, `gepauzeerd`, `beeindigd` |
| interval_months | integer | Frequentie (bijv. 3, 6, 12) |
| start_date | date | Startdatum |
| end_date | date | Einddatum (null = onbepaald) |
| last_generated_at | date | Laatste werkbon-generatie |
| next_due_date | date | Volgende gepland |
| assigned_to | uuid | Standaard monteur |
| price | numeric | Contractprijs per beurt |
| notes | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

RLS: company_id-based, zelfde patroon als andere tabellen.

---

### 2. Edge Function: `contract-generate`

Cron-achtige functie (handmatig of via scheduled trigger) die:
1. Alle actieve contracten ophaalt waar `next_due_date <= today`
2. Per contract een werkbon aanmaakt (via insert in `work_orders`)
3. Een afspraak aanmaakt (via insert in `appointments`) indien gewenst
4. `last_generated_at` en `next_due_date` bijwerkt

---

### 3. Frontend

**Nieuwe bestanden:**
- `src/pages/ContractsPage.tsx` — Overzicht met filters (actief/gepauzeerd/beeindigd), contractenlijst
- `src/components/ContractDialog.tsx` — Aanmaken/bewerken formulier
- `src/hooks/useContracts.ts` — CRUD hooks

**Bestaande aanpassingen:**
- `src/App.tsx` — Route `/contracts` toevoegen
- `src/hooks/useNavigation.tsx` — Page type `contracts` toevoegen
- `src/components/Sidebar.tsx` — Menu-item "Contracten" in sectie "Operatie"
- `src/components/MobileNav.tsx` — Menu-item toevoegen
- `supabase/config.toml` — Edge function entry

**Sidebar plaatsing:** Onder "Werkbonnen" in de "Operatie" sectie, met `FileText` of `RefreshCw` icon.

---

### 4. ContractsPage features

- Tabel met: klantnaam, contractnaam, dienst, interval, volgende datum, status
- Statusfilter tabs (Alle / Actief / Gepauzeerd / Beeindigd)
- "Nieuw contract" knop → ContractDialog
- Per contract: bewerken, pauzeren/hervatten, beeindigen
- Knop "Werkbonnen genereren" — roept edge function aan voor alle verlopen contracten

---

### Bestanden

| Bestand | Actie |
|---------|-------|
| Supabase migratie | `contracts` tabel + RLS |
| `supabase/functions/contract-generate/index.ts` | Nieuw |
| `supabase/config.toml` | Entry toevoegen |
| `src/pages/ContractsPage.tsx` | Nieuw |
| `src/components/ContractDialog.tsx` | Nieuw |
| `src/hooks/useContracts.ts` | Nieuw |
| `src/App.tsx` | Route toevoegen |
| `src/hooks/useNavigation.tsx` | Page type toevoegen |
| `src/components/Sidebar.tsx` | Menu-item toevoegen |
| `src/components/MobileNav.tsx` | Menu-item toevoegen |

