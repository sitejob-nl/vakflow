

# AutoFlow Status Overzicht

## Wat is gebouwd (Fase 1)

### 1. Voertuigbeheer + RDW-koppeling
- **Database**: `vehicles`, `vehicle_mileage_logs`, `workshop_bays` tabellen met RLS
- **Edge Function `rdw-lookup`**: Volledige v3 API integratie met parallel fetchen van:
  - Hoofddata (merk, model, bouwjaar, kleur, massa, etc.)
  - Brandstof (via `8ys7-d773`)
  - APK-keuringshistorie (via `vkij-7mwc`)
  - Geconstateerde gebreken + omschrijvingen (via `a34c-vvps` + `hx2c-gt7k`)
  - Terugroepacties (via `t49b-isb7`)
- **VehiclesPage**: Voertuiglijst met zoeken, APK-badges, CRUD
- **VehicleDialog**: Kentekeninvoer met RDW autofill
- **VehicleDetailPage**: Voertuigdossier met KPI's, werkbon-timeline, km-standen, APK-historie, gebreken, terugroepacties
- **useVehicles hook**: Volledige CRUD + RDW lookup + workshop bays

### 2. Werkbonnen voor Automotive
- **Database**: `vehicle_id`, `work_order_type`, `mileage_start`, `mileage_end`, `bay_id` kolommen op `work_orders`
- **WorkOrderDialog**: Bij automotive: voertuigselector (kenteken combobox), werkbontype dropdown, km-stand velden

### 3. Werkplaats-instellingen
- **WorkshopBaySettings**: Bruggen beheren (CRUD) in SettingsPage
- **ApkReminderSettings**: APK-herinneringen configureren (dagen, kanaal, template)

### 4. APK-herinneringen
- **Database**: `apk_reminder_settings`, `apk_reminder_logs` tabellen
- **Edge Function `apk-reminder-scan`**: Dagelijkse cron (08:00) die klanten automatisch waarschuwt
- **Settings UI**: Kanaal, intervallen, templates configureerbaar

### 5. Config & Navigatie
- **industryConfig.ts**: Automotive config met subcategorieën (garage, bandencentrale, schadeherstel)
- **Navigatie**: "Voertuigen" menu-item zichtbaar bij automotive
- **Routes**: `/vehicles`, `/vehicles/:id` actief

---

## Wat ontbreekt nog

### Fase 1 — Nog niet gebouwd

| Item | Status |
|------|--------|
| **Brugplanning (werkplaatsplanning)** | Niet gebouwd. PlanningPage heeft geen automotive-weergave met bruggen (Y-as) x tijdsloten (X-as). Geen drag & drop naar brug + tijdslot. |
| **Automotive Dashboard KPI's** | Niet gebouwd. Dashboard toont geen automotive-specifieke KPI's (voertuigen in werkplaats, brugbezetting, APK's deze maand). |
| **Navigatie-labels automotive** | Deels. "Voertuigen" is er, maar "Brugplanning" ipv "Route-planning" ontbreekt. Sidebar toont geen automotive-specifieke labels. |

### Fase 2 — Gepland maar niet gebouwd

| Item | Beschrijving |
|------|-------------|
| AI-intake | Slimme werkbon-aanmaak op basis van klantgesprek |
| Bandenopslag | Registratie, locatie, seizoenswissels |
| Onderdelen/voorraad | Artikelbeheer, voorraadbeheer, koppeling aan werkbonnen |

### Fase 3 — Gepland maar niet gebouwd

| Item | Beschrijving |
|------|-------------|
| Inruil & verkoop | Voertuigverkoop module |
| Uitgebreide rapportages | Automotive-specifieke rapporten (omzet per werkbontype, brugbezetting, etc.) |

---

## Aanbevolen volgende stap

De **brugplanning** in PlanningPage is het grootste ontbrekende stuk van Fase 1. Dit vereist:
- Een alternatieve weergave in PlanningPage wanneer `industry === "automotive"`: grid met bruggen (Y-as) x tijdsloten (X-as)
- Werkbonnen toewijzen aan brug + tijdslot
- Visuele overboeking-waarschuwing

Daarna de **automotive dashboard KPI's** toevoegen.

