

## Plan: RDW Lookup uitbreiden met Keuringen, Gebreken & Terugroepacties

### Wat

De bestaande `rdw-lookup` edge function uitbreiden met 4 extra RDW API calls (parallel) zodat bij een kenteken-lookup direct de volledige APK-historie, geconstateerde gebreken en terugroepacties worden opgehaald.

### Wijzigingen

**1. `supabase/functions/rdw-lookup/index.ts`**

Naast de bestaande main + fuel calls, 4 extra parallelle fetches toevoegen:

| Endpoint | Data | Veld in response |
|----------|------|-----------------|
| `vkij-7mwc` | APK keuringshistorie | `inspections` |
| `a34c-vvps` | Geconstateerde gebreken per keuring | `defects` |
| `t49b-isb7` | Terugroepactie status | `recalls` |
| `hx2c-gt7k` | Gebrekenlijst (referentie) | Wordt gejoind met `defects` voor omschrijvingen |

Alle calls worden parallel uitgevoerd via `Promise.allSettled` samen met de bestaande fuel call. Elke extra call is optional (falen blokkeert niet de response).

Response structuur wordt:
```json
{
  "found": true,
  "plate": "AB123C",
  "brand": "...",
  // ... bestaande velden ...
  "inspections": [
    { "expiry_date": "2025-06-15" }
  ],
  "defects": [
    { "date": "2024-01-10", "defect_id": "A1", "description": "Remschijf versleten", "count": 1 }
  ],
  "recalls": [
    { "status": "open", "ref_code": "..." }
  ],
  "has_open_recall": true
}
```

**2. `src/hooks/useVehicles.ts`**

Return type van `useRdwLookup` uitbreiden met de nieuwe velden (`inspections`, `defects`, `recalls`, `has_open_recall`).

**3. `src/pages/VehicleDetailPage.tsx`**

Nieuwe secties toevoegen in het voertuigdossier:
- **APK Historie** — tabel met keuringsdatums
- **Gebreken** — lijst geconstateerde gebreken met omschrijving
- **Terugroepacties** — badge/waarschuwing als er openstaande recalls zijn

De gebreken-referentielijst (`hx2c-gt7k`) is slechts ~1005 rijen en verandert zelden. We joinen de `gebrek_identificatie` in de edge function om de omschrijving mee te geven, zodat de frontend geen extra call hoeft te doen.

### Geen database wijzigingen nodig
Alle RDW keuringsdata wordt on-the-fly opgehaald en getoond. De `rdw_data` jsonb kolom op `vehicles` kan optioneel de volledige response cachen bij opslaan.

