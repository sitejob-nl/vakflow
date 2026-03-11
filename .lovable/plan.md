

# Fix: Exact API 404 op `/current/Me` endpoint

## Probleem

Het endpoint `/current/Me` wordt omgebouwd naar `/api/v1/{division}/current/Me`, maar Exact Online verwacht dit op `/api/v1/current/Me` (zonder division prefix). Dat verklaart de 404.

De uploaded werkende code (index_32.ts) gebruikt `exactFetch` met altijd `${baseUrl}/api/v1/${division}/${path}`, maar roept `/current/Me` nooit via die helper aan — het wordt apart afgehandeld.

## Oplossing

In `exact-api/index.ts`: detecteer endpoints die GEEN division prefix nodig hebben (zoals `/current/Me`) en bouw de URL correct op.

```
if endpoint starts with "/current/" → /api/v1/current/...
else → /api/v1/{division}/...
```

Eén kleine wijziging in de URL-constructie logica van `exact-api/index.ts`, daarna redeployen.

