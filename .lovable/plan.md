

# Projectbeheer — Fase 2

Grote feature: projecten als groepering van werkbonnen, afspraken, facturen en uren onder één klant.

## 1. Database migratie

**Tabellen:**
- `projects` — met company_id, customer_id, quote_id, address_id, asset_id, assigned_to, name, description, project_number, status, start/end/deadline dates, budget_amount, notes, tags
- `project_phases` — met project_id, company_id, name, description, sort_order, status, start/end dates, budget_amount

**FK's op bestaande tabellen:**
- `work_orders` + `project_id`, `project_phase_id`
- `appointments` + `project_id`
- `invoices` + `project_id`
- `time_entries` + `project_id`

**RLS:** Company isolation policies op beide nieuwe tabellen (subquery op profiles.company_id)

**Trigger:** `generate_project_number()` (bestaat al als functie, alleen trigger aanmaken op projects tabel)

**Indexen:** op company_id, customer_id, status (projects), project_id (phases + FK's)

## 2. Hook: `src/hooks/useProjects.ts` (nieuw)

Queries:
- `useProjects()` — lijst met customer join, gefilterd op companyId
- `useProject(id)` — enkel project + fases
- `useProjectStats(id)` — 3 losse queries: SUM invoices, COUNT work_orders (totaal + afgerond), SUM time_entries

Mutations:
- `useCreateProject`, `useUpdateProject`, `useDeleteProject`
- `useCreateProjectPhase`, `useUpdateProjectPhase`, `useDeleteProjectPhase`

## 3. Hook uitbreiding: `src/hooks/useQuotes.ts`

`useConvertQuoteToProject` — zelfde patroon als useConvertQuoteToContract:
- Insert project met name, budget_amount, customer_id, quote_id, asset_id
- Zet offerte status op "geaccepteerd"

## 4. Componenten (nieuw)

**`src/components/ProjectDialog.tsx`**
Formulier: klant (CustomerCombobox), naam, beschrijving, assigned_to, start/einddatum, deadline, budget, status, notities. Bij edit: prefill.

**`src/components/ProjectPhaseDialog.tsx`**
Formulier: naam, beschrijving, sort_order, start/einddatum, deelbudget, status.

## 5. Pagina's (nieuw)

**`src/pages/ProjectsPage.tsx`**
- Tabs: Alle / Actief / Afgerond
- Tabel: projectnummer, naam, klant, status, budget, gefactureerd, voortgang
- "Nieuw project" knop → ProjectDialog
- Klik → navigeer naar detail

**`src/pages/ProjectDetailPage.tsx`**
- Header met projectinfo + status-badge
- KPI-kaarten: Budget, Gefactureerd (progress bar), Betaald, Uren
- Fases-sectie: accordion per fase met gekoppelde werkbonnen
- Werkbonnen-sectie: lijst + "Nieuwe werkbon" knop (opent WorkOrderDialog met project_id)
- Facturen-sectie: lijst + "Nieuwe factuur" knop (opent InvoiceDialog met project_id)
- Afspraken-sectie: lijst + "Nieuwe afspraak"
- Uren-sectie: overzicht

## 6. Integratie bestaande componenten

**WorkOrderDialog:** optionele `projectId` prop → prefill customer_id + project_id in payload. Als project fases heeft: project_phase_id selector.

**InvoiceDialog:** optionele `projectId` prop → prefill customer_id + project_id. Toon budget-info.

**AppointmentDialog:** optionele `projectId` prop → project_id in payload.

**QuoteDialog + QuotesPage:** "Omzetten naar project" knop bij geaccepteerde offertes → useConvertQuoteToProject → navigeer naar ProjectDetailPage.

## 7. Navigatie & routing

**App.tsx:** Routes `/projects` en `/projects/:id` (AdminRoute)

**useNavigation.tsx:** Pages `projects` + `projDetail`, routeMap entries, pathToPage regexes

**Sidebar.tsx:** "Projecten" item in Operatie-sectie (tussen Planning en Werkbonnen), icon: FolderKanban, adminOnly: true

**industryConfig.ts:** `"projects"` toevoegen aan modules array van alle 5 industries

## Bestanden

| Bestand | Actie |
|---|---|
| SQL migratie | projects + project_phases + FK's + indexen + trigger |
| `src/hooks/useProjects.ts` | Nieuw — CRUD + stats |
| `src/hooks/useQuotes.ts` | useConvertQuoteToProject |
| `src/components/ProjectDialog.tsx` | Nieuw |
| `src/components/ProjectPhaseDialog.tsx` | Nieuw |
| `src/pages/ProjectsPage.tsx` | Nieuw |
| `src/pages/ProjectDetailPage.tsx` | Nieuw |
| `src/components/WorkOrderDialog.tsx` | projectId prop |
| `src/components/InvoiceDialog.tsx` | projectId prop |
| `src/components/AppointmentDialog.tsx` | projectId prop |
| `src/components/QuoteDialog.tsx` | "Project" knop |
| `src/pages/QuotesPage.tsx` | "Project" actieknop |
| `src/App.tsx` | Routes |
| `src/hooks/useNavigation.tsx` | projects + projDetail |
| `src/components/Sidebar.tsx` | Projecten menu-item |
| `src/config/industryConfig.ts` | projects module |

## Implementatievolgorde

1. Database migratie
2. useProjects hook
3. useConvertQuoteToProject in useQuotes
4. ProjectDialog + ProjectPhaseDialog
5. ProjectsPage + ProjectDetailPage
6. WorkOrderDialog/InvoiceDialog/AppointmentDialog projectId props
7. QuoteDialog/QuotesPage project-knop
8. Navigatie: routes, sidebar, industryConfig

## Niet in v1

Gantt-chart, automatische deelfacturatie, projecttemplates, uren per fase, budgetalarm-notificaties.

