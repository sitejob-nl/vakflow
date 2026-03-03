

## Plan: Migreer naar Google APIs, verwijder Mapbox

### Overzicht

Drie Edge Functions worden aangepast: `geocode-customers` migreert van Mapbox naar Google Geocoding API, `mapbox-proxy` wordt vervangen door een nieuwe `google-maps-proxy` met dezelfde interface (geocode + directions acties), en de `mapbox-proxy` function wordt verwijderd.

### Stap 1: Nieuwe `google-maps-proxy` Edge Function

Vervangt `mapbox-proxy` met dezelfde action-interface (`geocode`, `directions`) maar nu via Google APIs:

- **`geocode` action**: Roept `https://maps.googleapis.com/maps/api/geocode/json` aan met `address={query}&region=nl&language=nl&key={GOOGLE_ROUTES_API_KEY}`
  - Parsed de `address_components` om `street`, `house_number`, `postal_code`, `city` te extraheren
  - Retourneert exact hetzelfde `GeocodeSuggestion[]` formaat als voorheen
- **`directions` action**: Roept `https://routes.googleapis.com/directions/v2:computeRoutes` aan
  - Retourneert hetzelfde `{ duration_minutes, distance_km }` formaat

Dezelfde auth via `authenticateRequest()`, dezelfde input validatie.

### Stap 2: `geocode-customers` migreren

Vervangt de Mapbox geocoding call door Google Geocoding API. Zelfde structuur (batch 50 klanten, kleine delay), alleen de API call en response parsing verandert.

### Stap 3: Frontend aanpassen

Drie bestanden refereren naar `"mapbox-proxy"`:
- `src/hooks/useMapbox.ts` — `useGeocode` en `useDirections` → invoke `"google-maps-proxy"`
- `src/components/CustomerDialog.tsx` — auto-geocode bij opslaan → invoke `"google-maps-proxy"`

De hook-file hernoemen naar `useGoogleMaps.ts` (of de import alias behouden). De interfaces en return types blijven identiek.

### Stap 4: Opruimen

- **Verwijder** `supabase/functions/mapbox-proxy/index.ts`
- **Verwijder** de deployed `mapbox-proxy` function via delete tool
- Geen wijziging nodig in `config.toml` (mapbox-proxy had geen entry)

### Bestanden

| Bestand | Actie |
|---|---|
| `supabase/functions/google-maps-proxy/index.ts` | Nieuw — vervangt mapbox-proxy |
| `supabase/functions/geocode-customers/index.ts` | Wijzigen — Google Geocoding API |
| `supabase/functions/mapbox-proxy/index.ts` | Verwijderen |
| `src/hooks/useMapbox.ts` | Wijzigen — invoke `google-maps-proxy` |
| `src/components/CustomerDialog.tsx` | Wijzigen — invoke `google-maps-proxy` |

