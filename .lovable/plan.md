

# Bugfix migratie — 7 database bugs + frontend cleanup

## Migratie (één SQL-bestand)

### Bug 1: Dubbele trigger
```sql
DROP TRIGGER IF EXISTS trg_update_asset_on_wo_complete ON public.work_orders;
```

### Bug 2: work_orders.company_id NOT NULL
```sql
ALTER TABLE public.work_orders ALTER COLUMN company_id SET NOT NULL;
```

### Bug 3: Company-scoped unique constraints
```sql
ALTER TABLE public.work_orders DROP CONSTRAINT IF EXISTS work_orders_work_order_number_key;
ALTER TABLE public.work_orders ADD CONSTRAINT uq_wo_company_number UNIQUE (company_id, work_order_number);
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_key;
ALTER TABLE public.invoices ADD CONSTRAINT uq_inv_company_number UNIQUE (company_id, invoice_number);
```

### Bug 4: Quote number unique
```sql
ALTER TABLE public.quotes ADD CONSTRAINT uq_quotes_company_number UNIQUE (company_id, quote_number);
```

### Bug 5: RLS op reference data
```sql
ALTER TABLE public.rdw_defect_descriptions DISABLE ROW LEVEL SECURITY;
```

### Bug 6: Mileage update trigger
Nieuwe functie `update_vehicle_mileage_on_wo_complete()` + trigger: bij status → 'afgerond' met `vehicle_id` en `mileage_end`, update `vehicles.mileage_current`.

### Bug 7: Drop next_maintenance_date + herschrijf trigger
```sql
ALTER TABLE public.assets DROP COLUMN IF EXISTS next_maintenance_date;
```
Herschrijf `update_asset_maintenance_on_wo_complete()` zodat alleen `next_service_due` wordt gezet (geen referentie naar gedropte kolom).

## Frontend cleanup (next_maintenance_date → next_service_due)

Na het droppen van de kolom moeten 4 bestanden worden bijgewerkt:

| Bestand | Wijziging |
|---|---|
| `src/hooks/useAssets.ts` | Verwijder `next_maintenance_date` uit Asset interface |
| `src/hooks/useMaintenancePlanner.ts` | Vervang `next_maintenance_date` door `next_service_due` in select, order, interface en logica |
| `src/components/MaintenancePlannerWidget.tsx` | Vervang `next_maintenance_date` door `next_service_due` |
| `src/pages/AssetsPage.tsx` | Verwijder fallback `|| detailAsset.next_maintenance_date` |

