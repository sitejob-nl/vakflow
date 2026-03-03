

## Probleem

De `optimize-route` edge function retourneert `appointments_count: 0` omdat:

1. **`assigned_to` filter is te strikt**: Wanneer de employee filter op "all" staat, stuurt de frontend `assigned_to: undefined`. De edge function valt dan terug op `userId` (de ingelogde gebruiker). Als de afspraken niet aan jou persoonlijk zijn toegewezen, worden ze niet gevonden.

2. **Tijdzone mismatch**: De afspraken worden in UTC opgeslagen. De edge function zoekt op `2026-03-04T00:00:00` t/m `2026-03-04T23:59:59` (UTC), maar Nederlandse tijd is UTC+1. Afspraken gepland rond middernacht lokale tijd vallen buiten het bereik.

## Plan

### 1. Edge function `optimize-route` aanpassen
- Wanneer `assigned_to` niet is meegegeven, de `.eq("assigned_to", ...)` filter weglaten zodat alle afspraken van het bedrijf op die dag worden meegenomen
- Tijdzone-proof maken door het datumbereik te verruimen: `T00:00:00+01:00` of simpelweg een dag breder zoeken (`dayStart = ${date}T00:00:00+01:00`)

### 2. Frontend `PlanningPage.tsx`
- Geen wijziging nodig; de `undefined` waarde voor `assigned_to` is correct. De edge function moet dit beter afhandelen.

### Concrete wijzigingen

**`supabase/functions/optimize-route/index.ts`** (regels 21-36):
```typescript
const targetUser = assigned_to || null; // null = alle medewerkers
const dayStart = `${date}T00:00:00+01:00`;
const dayEnd = `${date}T23:59:59+01:00`;

let query = admin
  .from("appointments")
  .select("id, scheduled_at, duration_minutes, address_id, customer_id, status")
  .eq("company_id", companyId)
  .gte("scheduled_at", dayStart)
  .lte("scheduled_at", dayEnd)
  .neq("status", "geannuleerd")
  .order("scheduled_at");

if (targetUser) {
  query = query.eq("assigned_to", targetUser);
}
```

Daarna de edge function opnieuw deployen.

