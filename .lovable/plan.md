

# Plan: PWA Offline Functionaliteit

## Huidige situatie

De PWA is geconfigureerd met `vite-plugin-pwa` maar heeft geen offline caching strategie. De workbox config is minimaal — alleen `navigateFallbackDenylist` is ingesteld. Er is geen runtime caching, geen offline fallback pagina, en geen data caching.

## Wat wordt gebouwd

### 1. Workbox runtime caching strategie (`vite.config.ts`)

Configureer workbox met:
- **App shell** (HTML, CSS, JS): `CacheFirst` met max 60 entries, 30 dagen geldig
- **Supabase API calls**: `NetworkFirst` met 5 sec timeout fallback naar cache, max 100 entries, 1 uur geldig
- **Afbeeldingen**: `CacheFirst`, max 50 entries, 30 dagen
- **Google Fonts**: `StaleWhileRevalidate`
- `globPatterns`: Cache alle build-assets (`**/*.{js,css,html,ico,png,svg,woff2}`)

### 2. Offline fallback pagina (`public/offline.html`)

Simpele HTML pagina met Vakflow branding die toont: "Je bent offline. Controleer je internetverbinding en probeer opnieuw." Met een "Opnieuw proberen" knop.

### 3. Offline status banner (`src/components/OfflineBanner.tsx`)

React component dat `navigator.onLine` + `online`/`offline` events luistert. Toont een gele banner bovenaan het scherm wanneer de gebruiker offline gaat: "Je bent offline — sommige functies zijn beperkt."

### 4. PWAUpdatePrompt uitbreiden

Voeg `offlineReady` state toe aan de bestaande `useRegisterSW` hook en toon een korte toast wanneer de app klaar is voor offline gebruik.

## Bestanden

| Bestand | Wijziging |
|---------|-----------|
| `vite.config.ts` | Workbox runtime caching, offline fallback, globPatterns |
| `public/offline.html` | Nieuw: offline fallback pagina |
| `src/components/OfflineBanner.tsx` | Nieuw: online/offline status banner |
| `src/components/PWAUpdatePrompt.tsx` | offlineReady feedback toevoegen |
| `src/components/AppLayout.tsx` | OfflineBanner integreren |

