

# Bugfixes: WorkOrderDialog cleaning, companyId guards, window anti-pattern, SettingsPage split, sidebar filtering

## Probleem 1 — WorkOrderDialog cleaning-specifieke velden

De database heeft `vehicles_washed` (JSON), `vehicles_washed_total` (number) en `room_checklists` (JSON) op `work_orders`, maar de WorkOrderDialog vult ze nooit.

**Aanpak:**
- Detecteer `isCleaning` (industry === "cleaning") in WorkOrderDialog
- Bij cleaning + geselecteerd object: haal `object_type` op van het asset
  - `object_type === "fleet"`: toon wagenpark-telling velden (fleet_vehicle_types ophalen, per type een aantal-input → opslaan als `vehicles_washed` JSON + `vehicles_washed_total` som)
  - `object_type === "building"`: toon ruimte-checklist (object_rooms ophalen, per ruimte checkboxes voor de checklist items → opslaan als `room_checklists` JSON)
- Form state uitbreiden met `vehicles_washed` en `room_checklists`
- Submit payload conditioneel aanvullen (zoals automotive nu al doet)

**Bestanden:**
- `src/components/WorkOrderDialog.tsx` — cleaning velden toevoegen

## Probleem 3 — `if (companyId)` guard patroon

Alle hooks gebruiken conditionele company filtering. Fix: voeg `enabled: !!companyId` toe aan queries die het nog niet hebben, zodat ze niet draaien zonder company context.

**Bestanden:** `useWorkOrders.ts`, `useCustomers.ts`, `useAssets.ts`, `useContracts.ts`, `useInvoices.ts`, `useQuotes.ts`, `useAppointments.ts` — per hook `enabled: !!companyId` toevoegen aan de useQuery options.

## Probleem 4 — `window.__aiIntakeMaterials` anti-pattern

De materialen-suggestie wordt op `window` gezet maar nooit uitgelezen. Fix: verwijder de window assignment. Sla materialen op in component state (`aiMaterials`) en geef ze door aan de submit handler zodat ze na creatie beschikbaar zijn (bijv. als return value of via een callback).

**Bestanden:** `src/components/WorkOrderDialog.tsx`

## Probleem 5 — SettingsPage opsplitsen (4315 regels)

Split in tabbed subcomponenten. De huidige `BASE_TABS` array definieert al de tabs. Elke tab wordt een apart bestand:

| Component | Tabs |
|---|---|
| `SettingsProfileTab.tsx` | Profiel, Bedrijfsgegevens, App-voorkeuren |
| `SettingsServicesTab.tsx` | Diensten |
| `SettingsMaterialsTab.tsx` | Materialen (al apart: `MaterialsSettings`) |
| `SettingsTemplatesTab.tsx` | Sjablonen |
| `SettingsWorkshopTab.tsx` | Werkplaats (al apart: `WorkshopBaySettings`) |
| `SettingsAccountingTab.tsx` | Boekhouding |
| `SettingsEmailTab.tsx` | E-mail, E-mail Templates |
| `SettingsWhatsAppTab.tsx` | WhatsApp |
| `SettingsAutomationsTab.tsx` | Automatiseringen |
| `SettingsApkTab.tsx` | APK-herinneringen (al apart: `ApkReminderSettings`) |
| `SettingsTeamTab.tsx` | Teamleden |
| `SettingsIntegrationsTab.tsx` | Koppelingen |
| `SettingsMetaTab.tsx` | Meta (al apart: `MetaSettingsTab`) |

SettingsPage.tsx wordt de orchestrator: tab-selectie, routing, en rendert de juiste subcomponent.

**Bestanden:** 10+ nieuwe bestanden in `src/components/settings/`, `src/pages/SettingsPage.tsx` herschreven als orchestrator.

## Probleem 7 — Sidebar "Te plannen" voor alle industries

De sidebar filter checkt `enabledFeatures` (database), maar als die leeg is toont het alles. Fix: voeg een tweede filter toe die checkt of het item ook in `industryConfig.modules` zit voor de huidige industry.

**Aanpak in Sidebar.tsx:**
```
const industryModules = config.modules;
// filter items: must be in industryModules OR not industry-specific
items.filter(item => industryModules.includes(item.id) && ...)
```

**Bestanden:** `src/components/Sidebar.tsx`, `src/components/MobileNav.tsx` (zelfde filter)

## Probleem 6 — `as any` assertions (347x)

Niet in scope voor deze iteratie. Dit is een gevolg van de Supabase types die niet automatisch updaten bij schema-wijzigingen. Opmerking: de types.ts wordt automatisch gegenereerd en mag niet handmatig bewerkt worden.

---

## Implementatievolgorde

1. Sidebar industry-module filtering (klein, snel)
2. companyId guards op hooks (7-8 bestanden, mechanisch)
3. WorkOrderDialog cleaning velden (grootste wijziging)
4. WorkOrderDialog window anti-pattern fix
5. SettingsPage opsplitsen (grootste refactor qua bestanden)

