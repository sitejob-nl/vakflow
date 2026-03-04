

# Fix: PWA navigateFallback serveert offline pagina bij updates

## Probleem

In `vite.config.ts` staat `navigateFallback: "/offline.html"`. Workbox gebruikt dit als fallback voor **alle** navigatie-requests die niet in de cache staan. Wanneer de service worker update en de oude cache wordt gewist, valt elke pagina terug naar `offline.html` — zelfs als je online bent.

## Oplossing

Verander `navigateFallback` van `/offline.html` naar `/index.html` (de SPA entry point). Dit is het standaard Workbox-gedrag voor SPA's: bij een navigatie-request die niet in de precache zit, wordt de app-shell geserveerd in plaats van de offline pagina.

De `offline.html` pagina wordt dan alleen getoond via de `OfflineBanner` component wanneer `navigator.onLine` daadwerkelijk `false` is — wat al correct werkt.

## Wijziging

| Bestand | Wat |
|---------|-----|
| `vite.config.ts` | `navigateFallback: "/offline.html"` → `navigateFallback: "/index.html"` |

Eén regel wijziging, geen andere bestanden nodig.

