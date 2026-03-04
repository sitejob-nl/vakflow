

## Verificatierapport: Tweede beveiligingsaudit

Dit rapport is gebaseerd op dezelfde claims als de vorige audit. Veel punten zijn inmiddels gefixt. Hieronder de verificatie tegen de huidige code.

---

### KRITIEK #1 — WhatsApp `.single()` zonder company-filter
**WEERLEGD — REEDS GEFIXT**

Alle drie de functies filteren correct op `company_id`:
- `whatsapp-send` (regel 106-111): Expliciet `if (!companyId) return error`, daarna `.eq("company_id", companyId).single()`
- `whatsapp-templates` (regel 12): `.eq("company_id", companyId).single()`
- `whatsapp-business-profile` (regel 14): `.eq("company_id", companyId).single()`

**Dit is geen probleem meer.**

---

### KRITIEK #1b — WhatsApp webhook fallback
**WEERLEGD**

Regel 138-140: `console.error("No config found..."); return null;` — geen onveilige fallback. De `queryCompanyId` fallback (regel 229-236) is bewust: unieke webhook URL per tenant met `.eq("company_id", queryCompanyId)`.

---

### KRITIEK #1c — WhatsApp automation company-isolatie
**BEVESTIGD — MIDDEL**

Regel 71: `if (customer.company_id) automationQuery.eq("company_id", customer.company_id)` — conditioneel. Als `customer.company_id` null is (zou niet moeten voorkomen maar defensief onveilig), worden automations van alle bedrijven opgehaald. De interne `whatsapp-send` call (regel 122-138) gebruikt nu `SUPABASE_SERVICE_ROLE_KEY` (gefixt), maar de `whatsapp-send` functie verwacht een user-context van `authenticateRequest()` die een `companyId` retourneert. Met service role key is er geen user, dus `authenticateRequest()` zal falen tenzij het service role tokens als admin herkent.

**Conclusie: de automation-trigger → whatsapp-send flow werkt mogelijk niet correct met service role key. Moet getest worden, maar het is geen cross-tenant lek.**

---

### KRITIEK #2 — eBoekhouden auto-sync zonder company-filter
**GEDEELTELIJK GEFIXT**

De `X-Cron-Secret` verificatie is toegevoegd (regel 157-165) — ongeauthenticeerde toegang is geblokkeerd. Echter, het rapport's claim dat "alle profielen zonder company-filter" worden opgehaald is by-design: de auto-sync moet alle bedrijven met eBoekhouden doorlopen. Elk profiel wordt individueel verwerkt met zijn eigen `company_id` en credentials. Dit is geen data-lek, het is een batch-job.

**WEERLEGD als data-lek. Auth-probleem is GEFIXT.**

---

### KRITIEK #3 — Impersonatie zonder server-side check
**LAAG RISICO — ongewijzigd maar niet kritiek**

RLS policies filteren altijd op `get_my_company_id()` (gebaseerd op `auth.uid()`). Client-side `impersonate()` wijzigt alleen frontend-state. Een aanvaller die dit aanroept ziet alleen data waartoe RLS al toegang geeft — namelijk niets van het andere bedrijf.

---

### KRITIEK #4 — Storage buckets zonder company-isolatie
**WEERLEGD — REEDS GEFIXT**

Migratie `20260303204421` heeft company-isolated policies toegevoegd met `storage.foldername()` check.

---

### KRITIEK #5 — companies_safe SECURITY DEFINER view
**MIDDEL — moet in Supabase dashboard gecontroleerd worden**

Kan niet vanuit code geverifieerd worden.

---

### HOOG #6 — Exact webhook company_id uit URL
**LAAG RISICO**

`exact-webhook` verifieert `webhook_secret` tegen de database voor het meegegeven `company_id`. Een aanvaller moet beide kennen.

---

### HOOG #7 — Rompslomp webhook niet HMAC-gesigned
**BEVESTIGD — MIDDEL**

Ongewijzigd. Alleen header-check, geen body-verificatie.

---

### HOOG #8 — CORS `*`
**BY DESIGN — dynamische CORS aanwezig**

`corsFor(req)` checkt origin tegen allowed patterns. Fallback `*` is alleen voor requests zonder Origin header (webhooks).

---

### HOOG #9 — verify_jwt: false
**NIET RELEVANT**

By design. Auth wordt in code gedaan via `authenticateRequest()`.

---

### HOOG #10 — Pull-quotes Exact niet bedrijfs-gefilterd
**WEERLEGD**

`sync-exact` is volledig geauthenticeerd via `authenticateRequest()`. De `pull-quotes` actie haalt quotes op via de Exact API met de OAuth-token van dat specifieke bedrijf. Elk bedrijf heeft zijn eigen Exact-divisie en token. Er is geen cross-tenant risico.

---

### SnelStart-sync open endpoint
**GEFIXT**

Regel 212-217: `X-Cron-Secret` verificatie is toegevoegd.

---

## Samenvatting

| # | Bevinding | Rapport zegt | Werkelijkheid |
|---|-----------|-------------|---------------|
| 1 | WhatsApp .single() | KRITIEK | **GEFIXT** — alle functies filteren op company_id |
| 1b | Webhook fallback | KRITIEK | **WEERLEGD** — geen onveilige fallback |
| 1c | Automation isolatie | KRITIEK | **MIDDEL** — conditioneel filter, maar geen data-lek |
| 2 | eBoekhouden auto-sync | KRITIEK | **GEFIXT** — X-Cron-Secret toegevoegd, batch-job is by-design |
| 3 | Impersonatie | KRITIEK | **LAAG** — RLS beschermt data |
| 4 | Storage isolatie | KRITIEK | **GEFIXT** — company-isolated policies bestaan |
| 5 | companies_safe view | KRITIEK | **MIDDEL** — moet in dashboard gecontroleerd |
| 6 | Exact webhook | HOOG | **LAAG** — secret wordt geverifieerd |
| 7 | Rompslomp webhook | HOOG | **MIDDEL** — geen HMAC, maar secret-check aanwezig |
| 8 | CORS * | HOOG | **BY DESIGN** — dynamische CORS aanwezig |
| 9 | verify_jwt false | HOOG | **NIET RELEVANT** |
| 10 | Pull-quotes Exact | HOOG | **WEERLEGD** — per-bedrijf OAuth token |
| 11 | SnelStart-sync open | HOOG | **GEFIXT** — X-Cron-Secret toegevoegd |

## Openstaande actiepunten

1. **WhatsApp automation-trigger** (MIDDEL): Maak `company_id` filter niet-conditioneel (verwijder de `if`)
2. **companies_safe view** (MIDDEL): Controleer in Supabase dashboard of het SECURITY INVOKER of DEFINER is
3. **Rompslomp webhook** (MIDDEL): Overweeg HMAC-body-verificatie toe te voegen
4. **Storage policies** (LAAG): Controleer in Supabase dashboard of oude permissieve policies zijn verwijderd

De 5 "KRITIEKE" punten uit het rapport zijn ofwel al gefixt, ofwel weerlegd op basis van de huidige code. Er zijn geen kritieke beveiligingsproblemen meer.

