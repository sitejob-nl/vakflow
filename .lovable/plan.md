

## Marketing Module met Meta Integratie

Dit is een omvangrijk feature-verzoek met vier Meta-onderdelen. Ik stel een gefaseerde aanpak voor, te beginnen met de basis-infrastructuur en Facebook Leads (de meest directe CRM-waarde), gevolgd door Messenger/Instagram DM's en Page-beheer.

### Fase 1 — Infrastructuur (deze implementatie)

**Database tabellen:**

- `meta_config` — Slaat de Meta App credentials op per bedrijf (app_id, app_secret, page_access_token, page_id, instagram_account_id, company_id). Vergelijkbaar met `whatsapp_config`.
- `meta_leads` — Opslag van inkomende leads (lead_id, form_id, form_name, customer_data jsonb, status, customer_id nullable, company_id, created_at). Status: nieuw / gecontacteerd / klant / genegeerd.
- `meta_conversations` — Berichten van Messenger en Instagram DM's (platform: messenger/instagram, sender_name, sender_id, content, direction, customer_id, company_id, metadata jsonb, created_at).
- `meta_page_posts` — Cache van pagina-posts (post_id, message, created_time, likes, comments, shares, company_id).

**Edge Functions:**

- `meta-webhook` — Ontvangt webhooks van Meta voor leads, Messenger-berichten en Instagram DM's. Slaat data op in de juiste tabellen.
- `meta-api` — Proxy voor Meta Graph API calls (leads ophalen, berichten versturen, posts publiceren, page insights).

**Frontend:**

- Nieuwe `MarketingPage.tsx` met tabs: Leads, Messenger, Instagram, Pagina
- Route `/marketing` toevoegen aan `App.tsx`, `useNavigation.tsx`, `Sidebar.tsx`
- `marketing` toevoegen aan de `enabled_features` default array
- Leads-tab: tabel met inkomende leads, status wijzigen, lead omzetten naar klant
- Messenger-tab: chat-interface vergelijkbaar met WhatsApp-module
- Instagram-tab: DM chat-interface + berichten/reacties overzicht
- Pagina-tab: posts overzicht met engagement metrics

**Instellingen:**

- Meta-koppeling sectie op de SettingsPage: App ID, App Secret, Page Access Token invoeren + webhook URL tonen

### Technische details

**Meta App configuratie (door gebruiker):**
De gebruiker moet in Meta for Developers de volgende use cases selecteren (zoals in de screenshot):
- "Capture & manage ad leads" voor Lead Ads
- "Manage messaging & content on Instagram" voor Instagram DM's
- "Manage everything on your Page" voor Page-beheer
- "Engage with customers on Messenger" voor Messenger

De webhook URL wordt: `https://sigzpqwnavfxtvbyqvzj.supabase.co/functions/v1/meta-webhook`

**Benodigde secrets:**
- `META_APP_SECRET` — voor webhook signature verificatie (vergelijkbaar met WhatsApp webhook secret)

**Bestanden te maken/wijzigen:**

| Bestand | Actie |
|---------|-------|
| `src/pages/MarketingPage.tsx` | Nieuw — hoofdpagina met tabs |
| `src/hooks/useMetaLeads.ts` | Nieuw — CRUD voor leads |
| `src/hooks/useMetaConversations.ts` | Nieuw — berichten ophalen/versturen |
| `src/hooks/useMetaConfig.ts` | Nieuw — config ophalen |
| `supabase/functions/meta-webhook/index.ts` | Nieuw — webhook ontvanger |
| `supabase/functions/meta-api/index.ts` | Nieuw — Graph API proxy |
| `src/App.tsx` | Route toevoegen |
| `src/hooks/useNavigation.tsx` | Page type + route mapping |
| `src/components/Sidebar.tsx` | Menu-item toevoegen |
| `src/components/MobileNav.tsx` | Menu-item toevoegen |
| Migration SQL | 4 tabellen + RLS policies |

### Aanbeveling

Gezien de omvang stel ik voor om dit in 2-3 stappen te implementeren:
1. **Stap 1**: Database, config, edge functions + Leads tab (hoogste CRM-waarde)
2. **Stap 2**: Messenger + Instagram DM's (chat-interfaces)
3. **Stap 3**: Page-beheer (posts, insights)

Zal ik beginnen met stap 1 (database + leads)?

