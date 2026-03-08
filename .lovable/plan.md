

# AutoFlow Feature-matrix — Implementatieplan

Dit is een groot en ambitieus document. AutoFlow wijkt fundamenteel af van de andere branches doordat het centrale object een **voertuig (kenteken)** is in plaats van een locatie/adres. Laten we dit faseren conform de bouwvolgorde uit het document.

---

## Fase 1 — Basis (focus van dit plan)

### 1. Voertuigbeheer + RDW-koppeling

**Database:**
- Nieuwe tabel `vehicles` met kolommen: `id`, `company_id`, `customer_id`, `license_plate` (uniek per company), `vin`, `brand`, `model`, `build_year`, `fuel_type`, `color`, `apk_expiry_date`, `registration_date`, `vehicle_mass`, `mileage_current`, `mileage_updated_at`, `notes`, `status`, `rdw_data` (jsonb cache), `created_at`, `updated_at`
- Tabel `vehicle_mileage_logs`: `id`, `vehicle_id`, `mileage`, `recorded_at`, `work_order_id`, `recorded_by`
- RLS policies op `vehicles` en `vehicle_mileage_logs` (company_id scope)

**Edge Function: `rdw-lookup`**
- Roept RDW Open Data API aan: `https://opendata.rdw.nl/resource/m9d7-ebf2.json?kenteken={plate}`
- Gratis, geen API key nodig
- Retourneert merk, model, bouwjaar, brandstof, APK-vervaldatum, massa, kleur
- Wordt aangeroepen bij kentekeninvoer in de frontend

**Frontend:**
- Nieuwe pagina `VehiclesPage.tsx` — lijst voertuigen met zoeken op kenteken/klant
- `VehicleDialog.tsx` — aanmaken/bewerken met kentekeninvoer die RDW-lookup triggert en velden automatisch invult
- `VehicleDetailPage.tsx` — voertuigdossier met timeline (werkbonnen, facturen, km-standen)
- Alleen zichtbaar als `industry === "automotive"` — toevoegen als route + navigatie-item

### 2. Werkbonnen aanpassen voor Automotive

**Database:**
- Kolommen toevoegen aan `work_orders`: `vehicle_id`, `work_order_type` (enum: apk, kleine_beurt, grote_beurt, storing, bandenwissel, aflevering, overig), `mileage_start`, `mileage_end`, `bay_id`
- Nieuwe tabel `workshop_bays`: `id`, `company_id`, `name`, `description`, `is_active`, `sort_order`

**Frontend aanpassingen:**
- `WorkOrderDialog` — bij automotive: voertuigselector (kenteken combobox) ipv adres, werkbontype dropdown, km-stand velden
- Werkbon detail: toon voertuiginfo header

### 3. Werkplaatsplanning (Brugplanning)

**Frontend:**
- Nieuwe weergave in `PlanningPage` wanneer `industry === "automotive"`: grid met bruggen (Y-as) × tijdsloten (X-as)
- Drag & drop werkbonnen naar brug + tijdslot
- Overboeking-waarschuwing
- `WorkshopBaySettings` component op SettingsPage om bruggen te beheren

### 4. Dashboard aanpassen

- Bij automotive: KPI's tonen voor voertuigen in werkplaats, brugbezetting, APK's deze maand, open werkbonnen

### 5. Terminologie uitbreiden

- `industryConfig.ts` automotive labels uitbreiden met extra termen (werkplaatsorder, etc.)
- Navigatie-items aanpassen: "Voertuigen" ipv "Objecten", "Brugplanning" ipv "Route-planning"

---

## Fase 2 & 3 (later)

APK-herinneringen, AI-intake, bandenopslag, onderdelen/voorraad, inruil & verkoop — worden apart gebouwd na Fase 1.

---

## Technisch overzicht

| Bestand | Actie |
|---------|-------|
| Migratie | `vehicles`, `vehicle_mileage_logs`, `workshop_bays` tabellen + kolommen op `work_orders` |
| `supabase/functions/rdw-lookup/index.ts` | Nieuw — RDW Open Data proxy |
| `src/pages/VehiclesPage.tsx` | Nieuw — voertuiglijst |
| `src/components/VehicleDialog.tsx` | Nieuw — kenteken + RDW autofill |
| `src/pages/VehicleDetailPage.tsx` | Nieuw — voertuigdossier + timeline |
| `src/hooks/useVehicles.ts` | Nieuw — CRUD + RDW lookup |
| `src/components/WorkOrderDialog.tsx` | Aanpassen — voertuig/type/km-stand |
| `src/pages/PlanningPage.tsx` | Aanpassen — brugplanning view |
| `src/components/WorkshopBaySettings.tsx` | Nieuw — bruggen beheren |
| `src/pages/SettingsPage.tsx` | Aanpassen — bruggen tab voor automotive |
| `src/config/industryConfig.ts` | Uitbreiden — extra labels + modules |
| `src/App.tsx` | Routes toevoegen |
| `src/hooks/useNavigation.tsx` | Navigatie-items voor automotive |

Dit is een groot project. Wil je dat ik met **Fase 1 compleet** begin, of eerst alleen **Voertuigbeheer + RDW-koppeling** als eerste stap?

