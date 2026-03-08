

# CleanFlow Fase 1 — Implementatieplan

## Samenvatting

Objectbeheer (panden + wagenparken) met frequentieplanning, een "Te plannen" overzicht, aangepaste werkbonnen met checklists/tellingen, en cleaning-specifiek dashboard. Drie aanpassingen van gebruiker verwerkt: `frequency_days integer[]`, directe `next_service_due` berekening bij aanmaken, en `vehicles_washed_total integer` op work_orders.

---

## 1. Database migratie

### Assets tabel uitbreiden
- `object_type text NOT NULL DEFAULT 'building'` — 'building' of 'fleet'
- `frequency text DEFAULT 'weekly'` — daily, 2x_week, 3x_week, weekly, biweekly, monthly, quarterly, yearly
- `frequency_days integer[]` — array van weekdagen (0=ma..6=zo), bv. {0,2,4} voor ma/wo/vr
- `next_service_due date` — berekend bij aanmaken EN na werkbon
- `last_service_date date` — al aanwezig als `last_maintenance_date`, hergebruiken
- `surface_area integer` — m² voor panden
- `vehicle_count integer` — totaal voertuigen wagenpark
- `facilities text[]` — water, stroom, overdekt
- `access_instructions text`

### Nieuwe tabel `object_rooms`
Ruimte-indeling per pand met naam, type, checklist (jsonb), sort_order. FK naar assets + company_id. RLS company-scoped.

### Nieuwe tabel `fleet_vehicle_types`
Voertuigmix per wagenpark: vehicle_type, count, price_per_unit. FK naar assets + company_id. RLS company-scoped.

### Work_orders uitbreiden
- `vehicles_washed jsonb` — [{vehicle_type, count}]
- `vehicles_washed_total integer DEFAULT 0` — simpel getal voor rapportages
- `room_checklists jsonb` — per-ruimte checklist resultaten

### DB trigger: `calculate_next_service_due()`
Bij INSERT of UPDATE op assets: als `frequency` en `last_maintenance_date` gezet zijn, bereken `next_service_due` automatisch. Bijv. weekly = +7 dagen, biweekly = +14, monthly = +30, etc.

### Aanpassing bestaande trigger `update_asset_maintenance_on_wo_complete`
Na werkbon-afronding: `next_service_due` berekenen op basis van `frequency` ipv vaste `interval_months`.

---

## 2. Frontend — Objectbeheer

### `AssetDialog.tsx`
- Object-type toggle (Pand/Wagenpark) bovenaan, alleen voor cleaning industry
- **Pand**: oppervlakte, toegangsinstructies, inline ruimte-CRUD (object_rooms), frequentie + dagen-selector
- **Wagenpark**: voertuigaantal, faciliteiten checkboxes, voertuigtypen + tarieven tabel (fleet_vehicle_types), frequentie + dagen-selector
- Frequentie-dagen: multi-select checkboxes (ma t/m zo)

### `AssetsPage.tsx`
- Filter tabs: Alle / Panden / Wagenparken (alleen cleaning)
- Icon badge: Building2 vs Truck
- Kolommen: Frequentie, Volgende beurt (kleur: rood=te laat, oranje=<3 dagen)

### `useAssets.ts`
- Asset interface uitbreiden met nieuwe velden
- Nieuwe hooks: `useObjectRooms(assetId)`, `useFleetVehicleTypes(assetId)` — CRUD
- next_service_due direct meesturen bij create/update

---

## 3. Frontend — Te Plannen Overzicht

### Nieuwe pagina `ScheduleOverviewPage.tsx`
- Tabel met alle objecten gesorteerd op urgentie (achterstallig bovenaan)
- Kolommen: Object, Klant, Type (icoon), Frequentie, Laatste beurt, Status (dagen te laat / tot volgende)
- Kleur-indicatie: rood (achterstallig), oranje (vandaag/morgen), groen (op schema)
- "Inplannen" knop → opent WorkOrderDialog met asset voorgeselecteerd

### Routing & navigatie
- Route `/schedule` in App.tsx
- Page type `"schedule"` in useNavigation
- Sidebar: "Te plannen" item met CalendarCheck icoon in Operatie-sectie, alleen voor cleaning
- `industryConfig.ts`: module `"schedule"` toevoegen aan cleaning

---

## 4. Frontend — Werkbonnen aanpassen

### `WorkOrderDialog.tsx`
- Als cleaning + object type=fleet: "Voertuigen gewassen" sectie — numveld per voertuigtype uit fleet_vehicle_types, auto-sum naar `vehicles_washed_total`
- Als cleaning + object type=building: ruimte-checklists uit object_rooms, items afvinken
- Data opslaan in `vehicles_washed`, `vehicles_washed_total`, `room_checklists`

### `WorkOrderDetailPage.tsx`
- Toon voltooide checklists en voertuig-tellingen in detailview

---

## 5. Frontend — Dashboard

### `DashboardPage.tsx` (cleaning-specifiek blok)
- KPI cards: Actieve objecten, Achterstallig (next_service_due < vandaag), Opdrachten vandaag, Voertuigen gewassen deze maand
- "Te plannen" widget: top-5 meest urgente objecten met directe inplan-actie
- `useCleaningDashboard` hook voor de queries

---

## 6. Config & navigatie

| Bestand | Wijziging |
|---|---|
| Migratie SQL | assets kolommen, object_rooms, fleet_vehicle_types, work_orders kolommen, triggers, RLS |
| `src/hooks/useAssets.ts` | Uitbreiden interface, rooms & fleet hooks |
| `src/components/AssetDialog.tsx` | Object-type toggle, conditional velden |
| `src/pages/AssetsPage.tsx` | Filter tabs, extra kolommen |
| `src/pages/ScheduleOverviewPage.tsx` | Nieuw: te plannen dashboard |
| `src/hooks/useNavigation.tsx` | Page type "schedule" |
| `src/App.tsx` | Route /schedule |
| `src/components/Sidebar.tsx` | Nav-item "Te plannen" |
| `src/config/industryConfig.ts` | Module "schedule" bij cleaning |
| `src/components/WorkOrderDialog.tsx` | Cleaning checklists & voertuig-telling |
| `src/pages/WorkOrderDetailPage.tsx` | Toon cleaning data |
| `src/pages/DashboardPage.tsx` | Cleaning KPI's |
| `src/hooks/useCleaningDashboard.ts` | Nieuw: dashboard queries |

