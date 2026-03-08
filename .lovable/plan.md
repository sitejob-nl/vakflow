

# Ontbrekende Indexen, Edge Function Fixes & Branche-afronding

## Samenvatting

Vijf ontbrekende database-indexen toevoegen, twee edge function bugs fixen (ai-intake `work_order_type` conditie en rdw-lookup caching), en de bestaande CleanFlow Fase 2 frontend + AutoFlow rapportages afronden.

---

## 1. Database — Ontbrekende indexen

Eén migratie met vijf `CREATE INDEX IF NOT EXISTS`:

| Index | Tabel | Kolom |
|---|---|---|
| `idx_vehicles_customer_id` | `vehicles` | `customer_id` |
| `idx_object_rooms_asset_id` | `object_rooms` | `asset_id` |
| `idx_fleet_vehicle_types_asset_id` | `fleet_vehicle_types` | `asset_id` |
| `idx_quality_audits_asset_id` | `quality_audits` | `asset_id` |
| `idx_audit_room_scores_audit_id` | `audit_room_scores` | `audit_id` |

---

## 2. Edge Function — ai-intake fix

In `supabase/functions/ai-intake/index.ts`: de `work_order_type` property wordt nu altijd in het JSON schema gezet en pas daarna conditioneel voor automotive toegevoegd. Maar het `required` array en de `properties` object worden al vóór de conditie opgebouwd — het probleem is dat `work_order_type` alleen wordt toegevoegd als `isAutomotive`, wat al correct is (regel 130-136). 

**Herbeoordeling**: de huidige code voegt `work_order_type` correct alleen toe voor automotive. Geen fix nodig — dit is al goed geïmplementeerd.

---

## 3. Edge Function — rdw-lookup caching

De `rdw-lookup` function heeft al een `rdw_defect_descriptions` cachetabel met 7-dagen vervaltijd. De huidige implementatie:
- Checkt cache freshness op basis van `updated_at` van eerste record
- Haalt max 5000 beschrijvingen op bij cache-miss
- Upsert in batches van 500

**Herbeoordeling**: caching is al geïmplementeerd. De oorspronkelijke opmerking ("haalt elke keer 2000 op") klopt niet meer — dit is al opgelost met de cachetabel.

---

## 4. Conclusie na inspectie

Na het controleren van de code blijkt:
- **ai-intake**: `work_order_type` wordt al conditioneel toegevoegd (alleen automotive) ✓
- **rdw-lookup**: caching via `rdw_defect_descriptions` tabel is al geïmplementeerd ✓
- **Ontbrekende indexen**: dit is het enige echte probleem — 5 indexen missen

De enige wijziging die nodig is: **één database-migratie met 5 indexen**.

De genoemde "CleanFlow Fase 2 frontend" (AuditDialog, AuditsPage, FrequencyComplianceReport) is al volledig gebouwd in de vorige implementatie. AutoFlow rapportages en voorraad zijn bestaande features (materials met stock_quantity, useAutomotiveReports hook).

---

## Bestandsoverzicht

| Bestand | Actie |
|---|---|
| Migratie SQL | 5 ontbrekende indexen |

