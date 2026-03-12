

# KVK Lookup geeft geen resultaten — diagnose

## Probleem

De network requests tonen **"Failed to fetch"** voor alle calls naar `kvk-lookup`. Er zijn **geen edge function logs** — dat betekent dat de functie niet is gedeployed of crasht bij boot.

## Oorzaak

De CORS headers missen de extra Supabase client headers die de browser meestuurt. De `Access-Control-Allow-Headers` bevat alleen `authorization, x-client-info, apikey, content-type`, maar de Supabase JS client stuurt ook:
- `x-supabase-client-platform`
- `x-supabase-client-platform-version`
- `x-supabase-client-runtime`
- `x-supabase-client-runtime-version`

De browser blokkeert het preflight request (OPTIONS) en de eigenlijke POST komt nooit aan. Vandaar "Failed to fetch" zonder logs.

## Fix

### `supabase/functions/kvk-lookup/index.ts`

Update de `corsHeaders` om alle vereiste Supabase client headers toe te staan:

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
```

Verwijder ook `"Access-Control-Allow-Methods"` — die is niet nodig en kan verwarring veroorzaken.

Dat is de enige wijziging. Geen andere bestanden hoeven aangepast te worden.

