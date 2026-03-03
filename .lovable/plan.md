

## Plan: Route-optimalisatie met Google Routes API

### Overzicht

Een "Optimaliseer route" knop op het planningsscherm die afspraken van een dag via de Google Routes API in de optimale rijvolgorde herschikt, inclusief reistijden per leg.

### Stap 1: Google API key opslaan

De `GOOGLE_ROUTES_API_KEY` secret moet worden toegevoegd via de secrets tool.

### Stap 2: Edge function `optimize-route/index.ts`

Nieuwe edge function die:
1. Authenticatie via `authenticateRequest()` (shared helper)
2. Input: `{ date, assigned_to?, round_trip? }`
3. Haalt afspraken van die dag op voor de monteur (default: ingelogde user)
4. Verzamelt lat/lng uit `addresses` tabel (fallback: `customers` tabel)
5. Haalt bedrijfsadres op uit `companies` als startpunt
6. Roept Google Routes API `computeRoutes` aan met `optimizeWaypointOrder: true` en `TRAFFIC_AWARE` routing
7. Retourneert: optimale volgorde met `travel_time_minutes` en `distance_km` per stop, plus summary

API call naar:
```
POST https://routes.googleapis.com/directions/v2:computeRoutes
Headers: X-Goog-Api-Key, X-Goog-FieldMask
Body: { origin, destination, intermediates[], optimizeWaypointOrder: true, routingPreference: "TRAFFIC_AWARE" }
```

Het antwoord bevat `optimizedIntermediateWaypointIndex` (de optimale volgorde) en `routes[0].legs[]` met `duration` en `distanceMeters` per leg.

### Stap 3: Frontend hook in `useMapbox.ts`

Nieuwe `useOptimizeRoute` functie:
- Roept `supabase.functions.invoke("optimize-route", { body })` aan
- Retourneert de geoptimaliseerde stops met reistijden

### Stap 4: UI in `PlanningPage.tsx`

- **"Optimaliseer route" knop** in de desktop toolbar (naast "Nieuwe afspraak"), zichtbaar wanneer er ≥2 afspraken met coördinaten op de geselecteerde dag staan
- Bij klik:
  1. Roep `optimize-route` aan met de geselecteerde datum en monteur-filter
  2. Toon bevestigingsdialoog met de voorgestelde volgorde + geschatte rijtijden
  3. Na bevestiging: batch-update `scheduled_at` (herberekend op basis van optimale volgorde, eerste afspraak behoudt starttijd, volgende = vorige eindtijd + rijtijd) en `travel_time_minutes` per afspraak
- Op mobile: knop in de toolbar balk

### Stap 5: Config

Toevoegen aan `supabase/config.toml`:
```toml
[functions.optimize-route]
verify_jwt = false
```
(Auth wordt intern afgehandeld via `authenticateRequest()`)

### Bestanden

| Bestand | Actie |
|---|---|
| `supabase/functions/optimize-route/index.ts` | Nieuw |
| `supabase/config.toml` | Entry toevoegen |
| `src/hooks/useMapbox.ts` | `useOptimizeRoute` hook toevoegen |
| `src/pages/PlanningPage.tsx` | Knop + bevestigingsdialoog + batch-update logica |

### Beperkingen

- Google Routes API ondersteunt max 25 waypoints (ruim voldoende)
- Afspraken zonder coördinaten worden overgeslagen met een waarschuwing in de response

