

## Probleem

De logs bevestigen het: **"This authorization code has been used."**

Wanneer je een pagina selecteert, stuurt de frontend de OAuth `code` opnieuw naar `meta-oauth-callback`. De edge function probeert die code opnieuw te exchangeen bij Facebook, maar een OAuth code is single-use -- de eerste call heeft hem al verbruikt.

## Oplossing

De flow moet in twee fases werken:

### Fase 1: Code exchange (eerste call, werkt al)
- Exchange code → krijg `user_access_token` → haal pages op → sla `user_access_token` op in `meta_config` → return pages naar frontend

### Fase 2: Page selectie (tweede call, moet gefixed worden)

**Edge function (`meta-oauth-callback/index.ts`):**
- Bij `action: "select-page"`: **geen code exchange meer**. In plaats daarvan:
  - Haal de eerder opgeslagen `user_access_token` op uit `meta_config` (via `company_id` uit de state)
  - Gebruik die token om `/me/accounts` opnieuw te fetchen (of vertrouw op de page_access_token die al in de eerste response zat)
  - Sla de geselecteerde page op

**Frontend (`MetaCallbackPage.tsx`):**
- Bij `selectPage`: stuur **geen `code` en `redirect_uri`** meer mee, alleen `state`, `action: "select-page"`, en `page_id`
- Sla de pages (inclusief access_tokens) lokaal op in state zodat we de page_access_token direct mee kunnen sturen

### Aanpassingen

| Bestand | Wijziging |
|---------|-----------|
| `supabase/functions/meta-oauth-callback/index.ts` | Bij `select-page` action: skip code exchange, lees `user_access_token` uit DB of accepteer `page_access_token` direct uit request body |
| `src/pages/MetaCallbackPage.tsx` | `selectPage` stuurt alleen `state`, `page_id`, `action`, en de `page_access_token` (uit lokale state) -- geen `code`/`redirect_uri` |

