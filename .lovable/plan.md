

# CleanFlow Fase 2 — Kwaliteitsaudits, Scores & Frequentie-naleving

## 1. Database migratie

### Nieuwe tabel `quality_audits`
- `id uuid PK`, `company_id uuid NOT NULL`, `asset_id uuid REFERENCES assets(id) ON DELETE CASCADE`
- `auditor_id uuid REFERENCES profiles(id)` — consistent met rest van schema (niet auth.users)
- `audit_date date DEFAULT CURRENT_DATE`, `audit_type text DEFAULT 'internal'` (internal/customer)
- `overall_score numeric`, `notes text`, `status text DEFAULT 'concept'` (concept/afgerond)
- `created_at timestamptz DEFAULT now()`, `updated_at timestamptz DEFAULT now()`
- RLS: company-scoped SELECT/INSERT/UPDATE/DELETE

### Nieuwe tabel `audit_room_scores`
- `id uuid PK`, `audit_id uuid REFERENCES quality_audits(id) ON DELETE CASCADE`
- `room_id uuid REFERENCES object_rooms(id) ON DELETE SET NULL`
- `room_name text NOT NULL` — snapshot voor als room verwijderd wordt
- `criteria jsonb DEFAULT '[]'` — `[{ name: "Stof", score: 4, photo_url: null }]`
- `score numeric`, `notes text`, `created_at timestamptz DEFAULT now()`
- RLS: via join op quality_audits.company_id (of eigen company_id kolom voor eenvoud)

### Kolom op `assets`
- `avg_quality_score numeric` — bijgewerkt via trigger

### DB trigger `update_asset_avg_quality_score()`
Op INSERT/UPDATE van `quality_audits`:
- Filter op `status = 'afgerond'` (geen concepten)
- Filter op `company_id` EN `asset_id` van het gewijzigde record
- Bereken gemiddelde `overall_score` van laatste 5 afgeronde audits voor dat specifieke asset
- Update `assets.avg_quality_score` voor dat asset

## 2. Frontend — Hooks

### Nieuw: `src/hooks/useQualityAudits.ts`
- `useAudits(assetId?)` — lijst met join op `profiles(full_name)` voor auditornaam
- `useAudit(id)` — single audit met `audit_room_scores`
- `useCreateAudit()`, `useUpdateAudit()`, `useDeleteAudit()`
- `useAuditRoomScores(auditId)` — CRUD voor scores per ruimte

## 3. Frontend — AuditDialog

### Nieuw: `src/components/AuditDialog.tsx`
Multi-step formulier:
1. Object selecteren (combobox uit assets), auditdatum, type (intern/klant)
2. Per ruimte (uit `object_rooms` van geselecteerd asset) scoren op standaard criteria: Stof, Vlekken, Sanitair, Glas, Vloer, Afval — score 1-5 sterren per criterium, optioneel foto bij score < 3 (hergebruik bestaande `work-order-photos` bucket, pad: `audits/{audit_id}/{room_score_id}.jpg`), notitieveld per ruimte
3. Overzicht met berekende totaalscore, opslaan als 'afgerond'

## 4. Frontend — AuditsPage

### Nieuw: `src/pages/AuditsPage.tsx`
- Tabel: Object, Datum, Auditor, Score (kleur-badge), Status
- Filter op object, periode
- Klik → detail sheet met scores per ruimte en foto's
- Knop "Nieuwe audit" → AuditDialog

## 5. Frontend — Frequentie-nalevingsrapportage

### Nieuw: `src/components/FrequencyComplianceReport.tsx`
Tab of sectie op AuditsPage:
- Per object: gepland vs. uitgevoerd werk_orders in periode
- Gepland = frequentie omgerekend (daily=werkdagen, weekly=weken, 2x_week=2×weken, etc.)
- Nalevings% = (uitgevoerd/gepland) × 100
- Kleur: groen ≥90%, oranje 70-90%, rood <70%
- Periode-filter: deze maand, vorige maand, kwartaal

## 6. Dashboard & Assets integratie

- `useCleaningDashboard.ts`: toevoegen `avgQualityScore` query (gemiddelde van alle assets.avg_quality_score)
- `DashboardPage.tsx`: nieuwe KPI card "Gem. kwaliteitsscore" met trend-indicator
- `AssetsPage.tsx`: score badge in tabel/detail (uit `avg_quality_score` veld)

## 7. Navigatie & Config

- Route `/audits` in App.tsx
- Page type `"audits"` in useNavigation.tsx
- Sidebar: "Kwaliteit" item met ClipboardCheck icoon, alleen cleaning industry
- `industryConfig.ts`: module `"audits"` toevoegen aan cleaning modules array

## Bestandsoverzicht

| Bestand | Actie |
|---|---|
| Migratie SQL | quality_audits, audit_room_scores, assets.avg_quality_score, trigger, RLS |
| `src/hooks/useQualityAudits.ts` | Nieuw |
| `src/components/AuditDialog.tsx` | Nieuw |
| `src/pages/AuditsPage.tsx` | Nieuw |
| `src/components/FrequencyComplianceReport.tsx` | Nieuw |
| `src/hooks/useCleaningDashboard.ts` | Uitbreiden |
| `src/pages/DashboardPage.tsx` | KPI card toevoegen |
| `src/pages/AssetsPage.tsx` | Score badge |
| `src/config/industryConfig.ts` | Module "audits" |
| `src/App.tsx` | Route /audits |
| `src/hooks/useNavigation.tsx` | Page type "audits" |
| `src/components/Sidebar.tsx` | Nav-item "Kwaliteit" |

