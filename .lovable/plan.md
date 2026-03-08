

# Workflow Bugfixes — 8 problemen in 3 iteraties

## Iteratie 1: Database migratie (één migratie, alle schema + trigger wijzigingen)

### NOT NULL op 7 tabellen (Probleem 3)
Geverifieerd: geen NULL company_id waarden in enige tabel. Veilig om toe te passen.

```sql
ALTER TABLE invoices ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE customers ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE appointments ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE assets ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE quotes ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE services ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE materials ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE work_order_materials ALTER COLUMN company_id SET NOT NULL;
```

### vehicle_id op appointments (Probleem 6)
```sql
ALTER TABLE appointments ADD COLUMN vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL;
```

### Mileage trigger uitbreiden met log INSERT (Probleem 7)
Herschrijf `update_vehicle_mileage_on_wo_complete()` zodat die naast `vehicles.mileage_current` ook een rij in `vehicle_mileage_logs` insert. Dit vervangt de frontend INSERT en voorkomt race conditions. Beide wijzigingen (trigger uitbreiden + frontend verwijderen) zitten in dezelfde deploy.

### Status data-fix (Probleem 5)
Via insert tool: `UPDATE invoices SET status = 'verzonden' WHERE status = 'verstuurd'`

---

## Iteratie 2: Frontend workflow-correcties

### Materiaalkosten op factuur (Probleem 1) — `WorkOrderDetailPage.tsx`
In `handleCreateInvoice` (regel 180-219):
- Query `work_order_materials` voor de werkbon
- Map naar factuur-items: `{description: name, qty: quantity, unit_price, total}`
- Voeg toe aan items array
- Herbereken subtotal, vat_amount, total inclusief materialen

### Afspraak → werkbon: vehicle_id doorvoeren (Probleem 2) — `createWorkOrderFromAppointment.ts`
- Voeg `vehicle_id` toe aan `CreateWorkOrderPayload` interface
- In `buildWorkOrderPayload`: `vehicle_id: (appointment as any).vehicle_id ?? undefined`

### AppointmentDialog: voertuig-selector (Probleem 6) — `AppointmentDialog.tsx`
- Import `useCustomerVehicles` en `useIndustryConfig`
- Voeg `vehicle_id` toe aan form state
- Conditioneel (alleen automotive): toon voertuig-selector na klant-selectie
- Include `vehicle_id` in submit payload

### Frontend mileage log verwijderen (Probleem 7) — `WorkOrderDetailPage.tsx`
- Verwijder `createMileageLog.mutateAsync()` call in `handleStatusChange` (regel 135-146)
- Verwijder `useCreateMileageLog` import
- Behoud `mileage_end` update op werkbon (trigger leest die waarde)

### InvoicesPage statusConfig + WhatsApp trigger (Probleem 5 + 8)
- Voeg `verstuurd` als alias toe aan statusConfig (mappt naar dezelfde styling als `verzonden`)
- Na status → "betaald": roep `whatsapp-automation-trigger` aan met `trigger_type: "invoice_paid"`

### useMaterials guard
- Voeg `enabled: !!companyId` toe en gebruik `companyId!` i.p.v. conditionele filter

---

## Bestandsoverzicht

| Bestand | Actie |
|---|---|
| Migratie SQL | NOT NULL ×8, vehicle_id op appointments, mileage trigger herschrijven |
| Data-update (insert tool) | `UPDATE invoices SET status = 'verzonden' WHERE status = 'verstuurd'` |
| `src/pages/WorkOrderDetailPage.tsx` | Materialen op factuur + verwijder frontend mileage log |
| `src/utils/createWorkOrderFromAppointment.ts` | vehicle_id in payload |
| `src/components/AppointmentDialog.tsx` | vehicle_id form field + selector (automotive) |
| `src/pages/InvoicesPage.tsx` | verstuurd alias + WhatsApp betaald-trigger |
| `src/hooks/useMaterials.ts` | enabled guard |

## Implementatievolgorde
1. Migratie (schema + trigger) — alles in één
2. Data-fix verstuurd → verzonden
3. Frontend: materialen op factuur
4. Frontend: vehicle_id doorvoeren (appointment → workorder)
5. Frontend: mileage log verwijderen
6. Frontend: InvoicesPage fixes
7. Frontend: useMaterials guard

