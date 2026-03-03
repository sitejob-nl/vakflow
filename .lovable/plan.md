

## Huidige situatie vs. gewenste situatie

**Nu**: Elke gebruiker/bedrijf moet handmatig een Meta App aanmaken, App ID/Secret kopiëren, Page Access Token genereren via Graph API Explorer, etc. Dit is complex en foutgevoelig.

**Gewenst**: Jij (als platform-eigenaar) maakt één Meta App aan. Gebruikers klikken op "Koppel Facebook" en loggen in met hun Facebook-account. Het systeem krijgt automatisch de juiste tokens en page info.

## Oplossing: Facebook Login OAuth flow

### Architectuur

```text
Gebruiker klikt "Koppel Facebook"
        ↓
Browser redirect → Facebook Login dialog
  (permissions: pages_manage_metadata, pages_messaging, leads_retrieval, 
   instagram_manage_messages, pages_read_engagement, pages_manage_posts)
        ↓
Facebook redirect terug → /meta-callback?code=xxx
        ↓
Edge function "meta-oauth-callback":
  - Wisselt code in voor user access token
  - Haalt pagina's op via /me/accounts
  - Slaat page_access_token + page_id op in meta_config
        ↓
Gebruiker kiest welke Facebook Page te koppelen
        ↓
Klaar — alles werkt automatisch
```

### Wat verandert

**1. Systeembrede Meta App credentials als Supabase Secrets**
- `META_APP_ID` en `META_APP_SECRET` worden secrets (jij stelt ze één keer in)
- Niet meer per bedrijf opslaan — alle bedrijven gebruiken dezelfde app

**2. Nieuwe edge function: `meta-oauth-callback`**
- Ontvangt de `code` van Facebook na login
- Wisselt code → short-lived token → long-lived token
- Haalt `/me/accounts` op om beschikbare Pages te tonen
- Slaat page_access_token en page_id op in `meta_config`

**3. Nieuwe edge function: `meta-oauth-url`**
- Genereert de Facebook Login URL met juiste redirect_uri en permissions
- Voegt een `state` parameter toe met company_id voor CSRF-bescherming

**4. MetaSettingsTab vereenvoudigen**
- Verwijder handmatige invoervelden voor App ID, App Secret, Page Access Token
- Vervang door een "Koppel met Facebook" knop
- Na koppeling: toon welke Page gekoppeld is + disconnect knop
- Webhook verify token en Instagram Account ID blijven configureerbaar (of automatisch)

**5. meta_config tabel aanpassen**
- `app_id` en `app_secret` kolommen worden overbodig (staan als secrets)
- Eventueel `user_access_token` kolom toevoegen voor token refresh

### Bestanden

| Bestand | Actie |
|---------|-------|
| `supabase/functions/meta-oauth-url/index.ts` | Nieuw — genereert login URL |
| `supabase/functions/meta-oauth-callback/index.ts` | Nieuw — verwerkt OAuth callback |
| `src/pages/MetaCallbackPage.tsx` | Nieuw — vangt redirect op, stuurt code naar edge function |
| `src/components/MetaSettingsTab.tsx` | Vereenvoudigen — "Koppel met Facebook" knop |
| `supabase/functions/meta-api/index.ts` | Aanpassen — config lezen uit secrets i.p.v. meta_config voor app credentials |
| `src/App.tsx` | Route `/meta-callback` toevoegen |
| `supabase/config.toml` | Nieuwe functions registreren |

### Benodigde secrets
- `META_APP_ID` — je Meta App ID (één keer instellen)
- `META_APP_SECRET` — je Meta App Secret (één keer instellen)

### Facebook App configuratie (door jou)
In Meta for Developers moet je instellen:
- **Valid OAuth Redirect URI**: `https://vakflow.lovable.app/meta-callback`
- **Permissions**: `pages_manage_metadata`, `pages_messaging`, `leads_retrieval`, `instagram_manage_messages`, `pages_read_engagement`, `pages_manage_posts`

