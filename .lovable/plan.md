

## Verificatierapport: Beveiligingsaudit

Ik heb de broncode grondig gecontroleerd tegen alle 15 bevindingen. Hieronder het resultaat per punt.

---

### KRITIEK #1 — WhatsApp `.single()` zonder company-filter
**BEVESTIGD (GEDEELTELIJK)**

- `whatsapp-send` (regel 106-108): Config query voegt `company_id` filter toe via `if (companyId) configQuery.eq(...)`, maar als `companyId` om wat voor reden dan ook `null` is, pakt `.single()` de eerste config. Dit is een defensief probleem maar `authenticateRequest()` retourneert altijd een `companyId`, dus in de praktijk is dit veilig.
- `whatsapp-templates` (regel 12): **VEILIG** — filtert correct op `.eq("company_id", companyId)`.
- `whatsapp-business-profile` (regel 14): **VEILIG** — filtert correct op `.eq("company_id", companyId)`.

**Verdict: Het rapport overdrijft. Alleen `whatsapp-send` heeft een theoretisch probleem bij een null companyId. De andere twee functies zijn veilig.**

---

### KRITIEK #2 — eBoekhouden auto-sync zonder company-filter
**BEVESTIGD — KRITIEK**

Regel 156-160 in `sync-invoice-eboekhouden`: haalt alle profielen op zonder company-filter EN zonder enige authenticatie. Iedereen kan `{"action":"auto-sync"}` posten. Dit is het ernstigste probleem.

---

### KRITIEK #3 — Impersonatie zonder server-side check
**BEVESTIGD (LAAG RISICO)**

`impersonate()` in AuthContext is client-side only. Echter: alle data-queries gaan via Supabase met RLS policies die filteren op `get_my_company_id()` (gebaseerd op de echte `auth.uid()`). Een aanvaller die `impersonate()` aanroept in de console wijzigt alleen de frontend-state, niet de RLS-context. Data-lekken zijn dus **niet mogelijk via deze route** — de gebruiker ziet alleen data waartoe RLS al toegang geeft. Het enige risico is dat de frontend data van het geïmpersoneerde bedrijf probeert te laden maar RLS dit blokkeert.

**Verdict: Geen data-lek, alleen een UX-probleem. NIET kritiek.**

---

### KRITIEK #4 — Storage buckets zonder company-isolatie
**WEERLEGD**

Migratie `20260303204421` heeft company-isolated policies toegevoegd:
```sql
USING (bucket_id = 'work-order-photos'
  AND (storage.foldername(name))[1] = get_my_company_id()::text)
```
Zowel voor SELECT, INSERT als DELETE op beide buckets. **Dit is correct geïmplementeerd.**

Let op: er zijn mogelijk nog oude permissieve policies actief naast de nieuwe restrictieve policies. Dit moet gecontroleerd worden in het Supabase dashboard.

---

### KRITIEK #5 — companies_safe SECURITY DEFINER view
**BEVESTIGD (MIDDEL)**

Dit is een view zonder eigen RLS. Het erft de RLS van de onderliggende `companies` tabel niet automatisch als het een `SECURITY DEFINER` view is. Moet gecontroleerd worden of de view `SECURITY INVOKER` of `SECURITY DEFINER` is.

---

### HOOG #6 — Exact webhook vertrouwt URL company_id
**GEDEELTELIJK BEVESTIGD**

`exact-webhook` accepteert `company_id` uit de URL, maar verifieert het `webhook_secret` tegen de `exact_config` tabel voor dat specifieke `company_id`. Een aanvaller moet dus zowel de `company_id` als het bijbehorende `webhook_secret` kennen. **Risico is laag, niet hoog.**

---

### HOOG #7 — Rompslomp webhook niet HMAC-gesigned
**BEVESTIGD**

`rompslomp-webhook` verifieert alleen via `X-Webhook-Secret` header-matching tegen de database. Geen HMAC-body-verificatie. Als het secret lekt is webhook-injectie mogelijk.

---

### HOOG #8 — CORS * op alle edge functions
**BEVESTIGD, maar BY DESIGN**

De `_shared/cors.ts` heeft dynamische CORS (`corsFor()`) die origin checkt tegen allowed patterns. Maar de fallback is `*` voor requests zonder Origin (webhooks, server-to-server). Edge functions die `corsFor(req)` gebruiken zijn veilig. Functies die `corsHeaders` direct gebruiken krijgen `*`. Dit is acceptabel voor webhook-endpoints.

---

### HOOG #9 — verify_jwt: false overal
**NIET RELEVANT**

Dit is by-design conform de Supabase signing-keys architectuur. JWT-verificatie wordt gedaan in code via `authenticateRequest()`. Het rapport mist deze context.

---

### HOOG #10 — Pull-quotes Exact niet bedrijfs-gefilterd
**MOET GECONTROLEERD WORDEN**

Elke sync-exact aanroep is geauthenticeerd via `authenticateRequest()` die de `companyId` oplevert. De pull-quotes actie zou alleen data voor die company moeten ophalen. Moet de exacte implementatie verifiëren.

---

### SnelStart-sync open endpoint
**BEVESTIGD — HOOG**

`snelstart-sync` (regel 208-270) heeft geen authenticatie. Geen JWT-check, geen `X-Cron-Secret` check. Iedereen kan een POST sturen om alle SnelStart-verbindingen te syncen.

---

### WhatsApp webhook fallback
**WEERLEGD**

Het rapport claimt "pak eerste config". De code (regel 138-139) zegt expliciet: `console.error("No config found..."); return null;`. Er is geen onveilige fallback meer. De `queryCompanyId` fallback (regel 229-236) is een bewuste tenant-routing via unieke webhook URL's.

---

### WhatsApp automation company-isolatie
**GEDEELTELIJK BEVESTIGD**

Regel 66-71 in `whatsapp-automation-trigger`: de automation query filtert op `company_id` als `customer.company_id` beschikbaar is (`if (customer.company_id) automationQuery.eq(...)`). Echter: de `whatsapp-send` aanroep op regel 122-138 gebruikt de `SUPABASE_ANON_KEY` zonder user-specifieke auth, wat betekent dat de send-functie niet weet welk bedrijf het is. Dit is een authenticatieprobleem.

---

## Samenvatting: Wat is echt en wat niet

| # | Bevinding | Rapport zegt | Werkelijkheid |
|---|-----------|-------------|---------------|
| 1 | WhatsApp .single() | KRITIEK | **LAAG** — alleen whatsapp-send, theoretisch |
| 2 | eBoekhouden auto-sync | KRITIEK | **BEVESTIGD KRITIEK** |
| 3 | Impersonatie | KRITIEK | **LAAG** — RLS beschermt data |
| 4 | Storage isolatie | KRITIEK | **WEERLEGD** — policies bestaan |
| 5 | companies_safe view | KRITIEK | **MIDDEL** — moet gecontroleerd |
| 6 | Exact webhook | HOOG | **LAAG** — secret wordt geverifieerd |
| 7 | Rompslomp webhook | HOOG | **BEVESTIGD MIDDEL** |
| 8 | CORS * | HOOG | **BY DESIGN** — dynamische CORS aanwezig |
| 9 | verify_jwt false | HOOG | **NIET RELEVANT** — auth in code |
| 10 | SnelStart-sync open | — | **BEVESTIGD HOOG** |
| 11 | WhatsApp webhook fallback | KRITIEK | **WEERLEGD** — geen onveilige fallback |
| 12 | Automation auth | KRITIEK | **MIDDEL** — anon key probleem |

## Daadwerkelijke prioriteiten

**Fix nu:**
1. eBoekhouden `auto-sync` — voeg `X-Cron-Secret` verificatie toe
2. SnelStart-sync — voeg `X-Cron-Secret` verificatie toe
3. WhatsApp-send — maak `companyId` filter niet-conditioneel (verwijder de `if`)
4. WhatsApp automation-trigger — authenticeer de interne `whatsapp-send` call correct

**Plan:**
5. Controleer of oude permissieve storage policies nog actief zijn naast de nieuwe
6. Controleer of `companies_safe` view `SECURITY INVOKER` of `SECURITY DEFINER` is
7. Rompslomp webhook HMAC-verificatie toevoegen

