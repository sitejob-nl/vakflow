

## Analyse: Wat werkt er niet en waarom

Ik heb alle relevante code, network requests en edge function logs doorgenomen. Hier is de status per onderdeel:

### 1. Posts (Pagina tab) -- Permissie-probleem
- **Fout**: `OAuthException code 200, subcode 1340002` = "Permissions error"
- **Oorzaak**: Het Page Access Token mist de `pages_manage_posts` permissie. Dit is een Meta App configuratie-issue -- de app moet in Development mode staan met jou als Tester, of de permissie moet goedgekeurd zijn via App Review.
- **Geen code-aanpassing nodig**, alleen Meta Developer Portal configuratie.

### 2. Messenger & Instagram -- Geen berichten
- **Status**: Queries retourneren lege arrays (`[]`)
- **Oorzaak**: Berichten komen alleen binnen via de **meta-webhook** Edge Function. Deze moet geconfigureerd zijn in het Meta Developer Portal als callback URL. Zonder webhook ontvangt de app geen berichten.
- **Geen code-aanpassing nodig**, alleen webhook configuratie in Meta.

### 3. Leads -- Geen leads
- **Status**: Lege array
- **Oorzaak**: Zelfde als Messenger -- leads komen binnen via de webhook (`leadgen` events). Daarnaast mist de `leadsQuery` een `company_id` filter.
- **Code-fix nodig**: voeg `.eq("company_id", companyId)` toe aan `useMetaLeads`.

### 4. Page Insights -- Foutmelding
- **Fout**: `(#100) The value must be a valid insights metric`
- **Oorzaak**: De metrics `page_impressions`, `page_engaged_users`, `page_fans` zijn deprecated/gewijzigd in Graph API v21.0. De API verwacht nu andere metric-namen.
- **Code-fix nodig**: update de metrics naar geldige v21.0 waarden.

---

## Plan

### Stap 1: Fix `useMetaLeads` -- voeg company_id filter toe
Voeg `.eq("company_id", companyId)` toe aan de leadsQuery, net als bij conversations en posts.

### Stap 2: Fix page-insights metrics in edge function
Update de `page-insights` action in `meta-api/index.ts` om geldige Graph API v21.0 metrics te gebruiken. De huidige deprecated metrics worden vervangen door:
- `page_impressions_unique` (bereik)
- `page_post_engagements` (engagement)  
- `page_fans` (volgers -- deze bestaat nog steeds maar vereist `read_insights` permissie)

Alternatief: als de permissie `read_insights` niet beschikbaar is, kan de insights-sectie graceful een lege state tonen in plaats van een error.

### Stap 3: Betere error handling voor insights in frontend
In `useMetaPagePosts.ts` retourneert `pageInsights` al `null` bij errors, maar de edge function geeft een 200 terug met een error-body. De frontend moet dit ook als "geen data" behandelen.

### Handmatige stappen (geen code)
Je moet deze stappen zelf doen in het Meta Developer Portal:

1. **Voeg je Facebook-account toe als Tester/Developer** in je Meta App → App Roles
2. **Ontkoppel en koppel opnieuw** in Vakflow → Instellingen → Meta tab (zodat het token de juiste scopes krijgt)
3. **Configureer de webhook** in Meta Developer Portal:
   - Callback URL: `https://sigzpqwnavfxtvbyqvzj.supabase.co/functions/v1/meta-webhook`
   - Verify Token: `2320c88c-df58-4940-b6a6-f3dd38ad440d`
   - Subscriptions: `messages`, `messaging_postbacks`, `leadgen`

| Bestand | Wijziging |
|---------|-----------|
| `src/hooks/useMetaLeads.ts` | Voeg `company_id` filter toe |
| `supabase/functions/meta-api/index.ts` | Fix page-insights metrics, voeg error check toe |

