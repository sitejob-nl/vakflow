

## Plan: Security hardening — 3 bevindingen

### Bevinding 1: Edge Functions JWT-validatie audit

Na grondige analyse van alle 31+ Edge Functions is de conclusie dat **alle functies al correct authenticatie implementeren in de code zelf**:

| Function | Auth methode | Status |
|---|---|---|
| `whatsapp-send`, `sync-rompslomp`, `sync-moneybird`, `meta-api`, `meta-oauth-url`, `meta-oauth-callback`, `whatsapp-register`, `whatsapp-templates`, `whatsapp-business-profile`, `outlook-auth-url`, `mapbox-proxy` | `authenticateRequest()` (shared helper) | OK |
| `invite-user`, `save-smtp-credentials`, `send-email`, `generate-invoice-pdf`, `generate-quote-pdf`, `generate-workorder-pdf`, `outlook-send`, `outlook-calendar`, `fetch-emails`, `trigger-email-automation`, `geocode-customers` | Eigen `authHeader` + `getUser()` check | OK |
| `sync-invoice-eboekhouden` | `authHeader` + `getUser()` voor handmatige acties; `auto-sync` branch werkt server-side | OK |
| `reminder-scan` | `CRON_SECRET` header of JWT | OK |
| `whatsapp-automation-trigger` | Optionele auth (wordt intern aangeroepen) | OK |
| `whatsapp-webhook`, `meta-webhook`, `rompslomp-webhook` | Webhook signature verificatie | OK — geen JWT nodig |
| `outlook-callback` | OAuth callback — geen JWT nodig | OK |
| `whatsapp-config`, `rompslomp-config` | `X-Webhook-Secret` verificatie | OK |
| `company-signup` | Publiek endpoint voor registratie | OK — opzettelijk open |

**Conclusie**: Geen code-wijziging nodig. Alle functies valideren de caller intern. De `verify_jwt = false` in config.toml is correct omdat de signing-keys architectuur van Supabase dit vereist — JWT-validatie gebeurt in de function code via `getUser()` of `authenticateRequest()`.

Wel verwijder ik de onnodige entries uit `config.toml` voor functies die niet expliciet `verify_jwt = false` nodig hebben (standaard is al `false` bij signing-keys). De entries voor de webhook/callback functies houden we voor documentatiedoeleinden.

### Bevinding 2: Plaintext credentials

Dit is een grotere refactor die buiten de scope van deze actie valt. De huidige situatie:
- `smtp_password` en `eboekhouden_api_token` worden al **versleuteld opgeslagen** via `encrypt()` in `save-smtp-credentials`
- `outlook_refresh_token` wordt opgeslagen door `outlook-callback`
- `rompslomp_api_token` en `moneybird_api_token` worden via de UI opgeslagen

De kolommen die nog plaintext zijn: `outlook_refresh_token`, `rompslomp_api_token`, `rompslomp_webhook_secret`, `moneybird_api_token`. Dit vereist het updaten van alle lees- en schrijf-functions voor deze tokens — een aparte taak.

### Bevinding 3: Ontbrekende index op `edge_function_errors.company_id`

Eenvoudige migratie: één `CREATE INDEX` statement.

### Uitvoering

1. **Migratie**: Index toevoegen op `edge_function_errors.company_id`
2. **Config cleanup**: `config.toml` opschonen — alleen de functies die echt publiek moeten zijn behouden

