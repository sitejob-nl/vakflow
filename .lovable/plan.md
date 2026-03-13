

# Meta Marketing via SiteJob Connect — Implementatieplan

## Huidige situatie

Het project heeft al een **directe Meta/Facebook integratie** met eigen OAuth flow (`meta-oauth-url`, `meta-oauth-callback`), eigen token opslag in `meta_config` (columns: `page_access_token`, `user_access_token`, `page_id`, etc.), en een `meta-webhook` die direct Meta's HMAC-verificatie doet.

De opdracht is om over te stappen naar **SiteJob Connect** als centraal token-management platform, net zoals Exact Online dat al doet. Dit betekent:

- OAuth flow verloopt via Connect (popup naar `connect.sitejob.nl`)
- Tokens worden opgehaald via Connect's token endpoint (niet meer lokaal opgeslagen)
- Webhooks worden doorgestuurd door Connect (met `X-Webhook-Secret` verificatie)
- Config wordt gepusht door Connect na succesvolle koppeling

## Wat wordt gebouwd

### 1. Database: `meta_marketing_config` tabel

Nieuwe tabel naast bestaande `meta_config` (die blijft voor de legacy Messenger/Pages integratie):

```sql
CREATE TABLE public.meta_marketing_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE UNIQUE,
  tenant_id text,
  webhook_secret text,  -- encrypted opslaan
  ad_account_id text,
  ad_account_name text,
  page_id text,
  page_name text,
  instagram_id text,
  instagram_username text,
  granted_scopes text,
  is_connected boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

RLS: admin-only per company, service role full access.

### 2. Edge Function: `meta-marketing-register` 

Registreert tenant bij SiteJob Connect (idempotent). Volgt exact het patroon van `exact-register`:
- Authenticeer user, haal companyId
- POST naar `meta-marketing-register-tenant` met `X-API-Key: CONNECT_API_KEY`
- Sla `tenant_id` + `webhook_secret` op in `meta_marketing_config`

### 3. Edge Function: `meta-marketing-config`

Ontvangt config push van SiteJob Connect na OAuth:
- `verify_jwt = false` in config.toml
- Verificatie via `X-Webhook-Secret` header
- Slaat `ad_account_id`, `page_id`, `instagram_id`, etc. op
- Handelt `action: "disconnect"` af

### 4. Edge Function: `meta-marketing-webhook`

Ontvangt doorgestuurde Meta webhooks van Connect:
- `verify_jwt = false`
- Verificatie via `X-Webhook-Secret` header (lookup op tenant_id)
- Verwerkt `leadgen`, `feed`, `messages` events
- Slaat leads op in bestaande `meta_leads` tabel

### 5. Shared module: `_shared/meta-marketing-connect.ts`

Token-ophaal helper (zoals `exact-connect.ts`):

```typescript
export async function getMetaMarketingToken(config: { tenant_id: string; webhook_secret: string }) {
  const res = await fetch(".../meta-marketing-token", {
    method: "POST",
    body: JSON.stringify({ tenant_id: config.tenant_id, secret: config.webhook_secret }),
  });
  // Returns user_access_token, page_access_token, ad_account_id, etc.
}
```

### 6. Edge Function: `meta-marketing-api`

Proxy voor Meta Graph API calls met verse tokens:
- Actions: `campaigns`, `adsets`, `ads`, `insights`, `page-posts`, `publish-post`, `instagram-media`, `instagram-insights`, `status`
- Haalt token op via `getMetaMarketingToken()` bij elke call
- Voert Graph API call uit en retourneert resultaat

### 7. UI: MetaSettingsTab uitbreiden

Het bestaande `MetaSettingsTab.tsx` wordt uitgebreid met een "Meta Marketing (Ads)" sectie:
- "Koppel via SiteJob Connect" knop opent popup naar `connect.sitejob.nl/meta-marketing-setup?tenant_id=...`
- PostMessage listener voor `meta-marketing-connected` event
- Status weergave: connected/disconnected, ad account naam, page naam
- Ontkoppel knop

### 8. UI: MarketingPage uitbreiden met Ads tab

Nieuwe tab "Advertenties" met:
- Campagne overzicht (naam, status, budget)
- Ad account insights (impressions, clicks, spend, CPC, CTR) voor laatste 30 dagen
- Instagram media overzicht

### 9. Hook: `useMetaMarketing`

React hook voor:
- Config status ophalen
- Tenant registreren
- Token/status queries
- Graph API calls via `meta-marketing-api`

## Bestaande code

De bestaande directe Meta integratie (`meta-api`, `meta-oauth-url`, `meta-oauth-callback`, `meta-webhook`) blijft intact. De nieuwe SiteJob Connect integratie is een parallelle, betere flow die de token-management outsourcet.

## Volgorde van implementatie

1. Database migratie (`meta_marketing_config`)
2. Shared module `meta-marketing-connect.ts`
3. Edge functions: `meta-marketing-register`, `meta-marketing-config`, `meta-marketing-webhook`, `meta-marketing-api`
4. Config.toml updates
5. Frontend hook `useMetaMarketing`
6. UI: Settings tab + Marketing page uitbreiding

## Secrets

`CONNECT_API_KEY` is al geconfigureerd als Supabase secret. Geen nieuwe secrets nodig.

