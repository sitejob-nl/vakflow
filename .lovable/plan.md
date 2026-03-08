

## Roadmap: Concurrentie-gap dichten

Op basis van je selectie zijn dit 6 grote features. Hier is de prioriteitsvolgorde op basis van impact vs complexiteit:

### Fase 1 — Quick wins (per stuk ~1 sessie)

| # | Feature | Complexiteit | Impact |
|---|---------|-------------|--------|
| 1 | **Inklapbare sidebar** | Laag | Hoog — modernere UX, meer ruimte |
| 2 | **Rijker dashboard met grafieken** | Medium | Hoog — eerste indruk, KPI-overzicht |
| 3 | **Onboarding checklist** | Medium | Hoog — activatie nieuwe gebruikers |

### Fase 2 — Kernmodules (per stuk ~2-3 sessies)

| # | Feature | Complexiteit | Impact |
|---|---------|-------------|--------|
| 4 | **Drag & drop planbord** | Hoog | Hoog — daily driver feature |
| 5 | **Contracten module** | Hoog | Hoog — recurring revenue tracking |
| 6 | **Projecten module** | Hoog | Medium — grotere bedrijven |

---

### 1. Inklapbare sidebar

Huidige `Sidebar.tsx` is een vaste 240px brede aside. Omzetten naar Shadcn `Sidebar` met `collapsible="icon"` modus.

- Sidebar klapt in tot ~56px breed met alleen iconen
- `SidebarTrigger` in de Header zodat toggle altijd zichtbaar is
- Collapsed state opslaan in `localStorage`
- `AppLayout.tsx` wrappen met `SidebarProvider`

**Bestanden:** `Sidebar.tsx`, `AppLayout.tsx`, `Header.tsx`

### 2. Rijker dashboard met grafieken

Het huidige dashboard heeft 4 KPI-kaarten en lijsten. Toevoegen:

- **Omzet-lijn/barchart** (maandelijks, via `recharts` — al geïnstalleerd)
- **Werkbon-status donut chart** (open/bezig/afgerond verdeling)
- **Pipeline-kaart** (openstaande offertes totaalwaarde)
- Layout herschikken naar 2-kolom grid met grafieken bovenaan

**Database:** Nieuwe Supabase query/hook voor maandelijkse omzetdata en werkbon-status aggregatie.
**Bestanden:** `DashboardPage.tsx`, nieuw `useDashboardCharts.ts` hook

### 3. Onboarding checklist

Dashboard-widget voor nieuwe accounts (tonen zolang niet alle stappen voltooid):

- Stappen: Bedrijfsgegevens invullen, Eerste dienst aanmaken, Eerste klant toevoegen, Eerste afspraak plannen, E-mail/WhatsApp instellen
- Progressiebalk bovenaan
- Elke stap linkt naar de juiste pagina
- Voortgang opslaan in `profiles.onboarding_completed` (al aanwezig) + nieuw JSONB veld `onboarding_progress`

**Bestanden:** Nieuw `OnboardingChecklist.tsx`, `DashboardPage.tsx`, migratie voor `onboarding_progress`

### 4. Drag & drop planbord

De planning (`PlanningPage.tsx`, ~1600 regels) uitbreiden met:

- HTML5 drag & drop op event cards in weekview
- Drop-zones per dag/tijdslot en per medewerker-kolom
- Bij drop: `scheduled_at` en optioneel `assigned_to` updaten
- Visuele feedback tijdens drag (ghost card, highlight drop-zone)

**Bestanden:** `PlanningPage.tsx`, mogelijk extractie naar subcomponenten

### 5. Contracten module

Nieuwe module voor terugkerende servicecontracten:

- **Database:** `contracts` tabel (klant, type werk, interval, start/einddatum, actief-status, bedrag)
- **UI:** Contractenlijst met filters, contract-aanmaak dialog
- **Automatisering:** Cron/trigger die werkbonnen genereert op basis van contractinterval
- **Sidebar/routing:** Nieuwe pagina + navigatie-item

### 6. Projecten module

Projecten als container voor meerdere werkbonnen/offertes/facturen:

- **Database:** `projects` tabel + `project_id` FK op werkbonnen, offertes, facturen
- **UI:** Projectoverzicht met voortgang, nacalculatie (budget vs werkelijk)
- **Sidebar/routing:** Nieuwe pagina

---

### Aanbevolen startvolgorde

Begin met **Inklapbare sidebar** — het is de snelste win, verbetert direct de look & feel, en raakt minimaal andere code. Daarna **Dashboard grafieken** en **Onboarding checklist**.

Welke feature wil je als eerste implementeren?

