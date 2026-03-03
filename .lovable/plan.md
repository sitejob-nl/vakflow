

## Plan: Beveiligingsfixes — Transportlaag en Multi-tenant Scoping

### Belangrijk: verify_jwt = true

Dit project gebruikt Supabase's signing-keys systeem, waardoor `verify_jwt = true` op gateway-niveau **niet werkt**. Alle JWT-validatie moet in de function code zelf gebeuren. Dat maakt de overige fixes des te belangrijker.

De functies die nu in `config.toml` staan met `verify_jwt = false` maar die WEL auth doen in code, kunnen daar **niet** uit — ze moeten `verify_jwt = false` houden. De extra entries voor functions die niet in config.toml staan (zoals `send-email`, `generate-invoice-pdf`) gebruiken al het default gedrag en doen intern al auth checks met `getUser()`.

---

### Stap 1: Fix `getClaims()` → `authenticateRequest()` in sync-rompslomp en sync-moneybird

Beide functions gebruiken nog `getClaims(token)` — een **niet-bestaande methode**. Elke aanroep faalt. Refactor naar `authenticateRequest()` uit `_shared/supabase.ts` + gebruik shared `cors.ts` en `jsonRes`.

| Bestand | Wijziging |
|---------|-----------|
| `sync-rompslomp/index.ts` | Vervang regels 1-102 (imports, cors, auth) door shared imports + `authenticateRequest()` |
| `sync-moneybird/index.ts` | Idem, regels 1-118 |

### Stap 2: whatsapp-config multi-tenant fix

**Probleem**: Hardcoded UUID `00000000-0000-0000-0000-000000000001` bij upsert. Disconnect doet `.delete().neq("id", ...)` — verwijdert potentieel alles.

**Fix in `whatsapp-config/index.ts`**:
- Upsert: gebruik `company_id` of `tenant_id` als natural key (via `onConflict: "phone_number_id"` of lookup op tenant_id), verwijder hardcoded UUID
- Disconnect: scope op `tenant_id` uit de body (de webhook secret is al geverifieerd)

### Stap 3: whatsapp-send disconnect scoping

**Probleem**: Regel 111 doet `.delete().neq("id", "00000000-...")` — verwijdert alle configs.

**Fix**: Vervang door `.delete().eq("company_id", companyId)`.

### Stap 4: outlook-callback state HMAC signing

**Probleem**: State `companyId|appOrigin` in plaintext. Aanvaller kan tokens koppelen aan willekeurig bedrijf.

**Fix**:
- `outlook-auth-url/index.ts`: HMAC-sign state met `SMTP_ENCRYPTION_KEY`. Format: `companyId|appOrigin|hmac`. Refactor ook naar shared modules.
- `outlook-callback/index.ts`: Verifieer HMAC signature voordat companyId wordt gebruikt. Refactor naar shared modules, dedupliceer `encrypt()` naar `_shared/crypto.ts`.

### Stap 5: reminder-scan auth verplichting

**Probleem**: Zonder auth draait de function door op service_role voor alle tenants.

**Fix**: Voeg een `CRON_SECRET` header check toe. Zonder geldig JWT of matching `X-Cron-Secret` header → 401. Een nieuw secret `CRON_SECRET` moet worden aangemaakt.

### Stap 6: Shared crypto module

Dedupliceer `encrypt()`/`decrypt()` logica (nu in `outlook-callback`, `save-smtp-credentials`, `send-email`) naar `_shared/crypto.ts`. Verwijder de SHA-256 fallback — als de key geen geldige 32-byte hex of base64 is, throw een error.

---

### Samenvatting

| Bestand | Fix |
|---------|-----|
| `sync-rompslomp/index.ts` | `getClaims()` → `authenticateRequest()` |
| `sync-moneybird/index.ts` | `getClaims()` → `authenticateRequest()` |
| `whatsapp-config/index.ts` | Natural key upsert + scoped disconnect |
| `whatsapp-send/index.ts` | Scoped disconnect op company_id |
| `_shared/crypto.ts` | Nieuwe shared module voor encrypt/decrypt, strict key validation |
| `outlook-auth-url/index.ts` | HMAC-sign state + refactor naar shared modules |
| `outlook-callback/index.ts` | Verifieer HMAC + refactor naar shared modules + shared crypto |
| `save-smtp-credentials/index.ts` | Gebruik `_shared/crypto.ts` |
| `send-email/index.ts` | Gebruik `_shared/crypto.ts` |
| `reminder-scan/index.ts` | Cron secret check verplicht |

Nieuw secret nodig: `CRON_SECRET` (willekeurige string voor cron job authenticatie).

Geen database changes nodig.

