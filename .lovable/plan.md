

# Fix: Vercel 404 bij directe navigatie (SPA rewrite)

## Probleem

Vercel weet niet dat dit een Single Page Application is. Bij directe navigatie naar bijv. `/dashboard` zoekt Vercel naar een bestand `/dashboard/index.html`, dat niet bestaat → 404.

Netlify heeft `public/_redirects`, maar Vercel gebruikt `vercel.json`.

## Oplossing

Voeg een `vercel.json` toe in de project root met een catch-all rewrite naar `index.html`:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Eén bestand, klaar.

| Bestand | Actie |
|---------|-------|
| `vercel.json` | Nieuw — SPA rewrite regel |

