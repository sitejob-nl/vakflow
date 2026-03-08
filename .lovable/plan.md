

# Bugfix batch — 6 problemen (P1-P4 + P6-P7)

## P1: AI intake materialen koppelen aan werkbon

**Bestand:** `src/components/WorkOrderDialog.tsx`

Na `createWO.mutateAsync(payload)` worden `aiMaterials` als `work_order_materials` ingevoegd. Verbetering t.o.v. origineel plan: als `m.material_id` bestaat, wordt de `unit_price` opgehaald uit de `useMaterials()` data (die al geladen is). Geen extra query nodig.

- Import `useAddWorkOrderMaterial` en `useMaterials` 
- Na succesvolle create: loop over `aiMaterials`, lookup prijs via `materials.find(mat => mat.id === m.material_id)?.unit_price ?? 0`
- Insert via `addWOMaterial.mutateAsync({ work_order_id, material_id, name, unit, quantity, unit_price })`

## P2: NOT NULL op 4 tabellen

**SQL migratie:**
```sql
ALTER TABLE communication_logs ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE notifications ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE whatsapp_messages ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE time_entries ALTER COLUMN company_id SET NOT NULL;
```

## P3: enabled_features default uitbreiden

**SQL migratie:** Update de column default naar alle 18 modules inclusief `schedule`, `audits`, `vehicles`, `trade`.

**Edge function:** `company-signup/index.ts` — accepteer `industry` en `subcategory` in payload, sla op bij company creation, en zet `enabled_features` op basis van `industryConfig[industry].modules`.

## P4: contracts module toevoegen aan industryConfig

**Bestand:** `src/config/industryConfig.ts` — `"contracts"` toevoegen aan elke industry's `modules` array.

## P6: BTW-percentage instelbaar

**Bestand:** `src/components/InvoiceDialog.tsx` — BTW-selector (0%, 9%, 21%) toevoegen. Herberekening van subtotal/vat/total op basis van gekozen percentage (i.p.v. hardcoded 1.21).

**Bestand:** `src/pages/WorkOrderDetailPage.tsx` — `vatPercentage` variabele (regel 201) vervangen door instelbare waarde, of 21 als default behouden maar de kolom correct doorgeven.

## P7: FK-indexen

**SQL migratie:** ~25 `CREATE INDEX IF NOT EXISTS` statements voor de meest kritieke FK-kolommen. Zonder `CONCURRENTLY` (niet ondersteund in transacties via migratie-tool).

---

## Implementatievolgorde

1. Database migratie (NOT NULL + default + indexen) — 1 migratie
2. `company-signup` edge function (industry-aware features)
3. `WorkOrderDialog.tsx` (AI materialen koppelen met prijsopzoek)
4. `InvoiceDialog.tsx` (BTW-selector)
5. `industryConfig.ts` (contracts module)

## Bestanden

| Bestand | Wijziging |
|---|---|
| SQL migratie | NOT NULL ×4, default enabled_features, 25 indexen |
| `supabase/functions/company-signup/index.ts` | industry/subcategory + enabled_features |
| `src/components/WorkOrderDialog.tsx` | AI materialen schrijven na create, prijs uit catalogus |
| `src/components/InvoiceDialog.tsx` | BTW-selector 0/9/21% |
| `src/pages/WorkOrderDetailPage.tsx` | BTW via selector i.p.v. hardcoded |
| `src/config/industryConfig.ts` | contracts toevoegen aan alle modules |

