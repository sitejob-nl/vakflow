

## Analyse: Geupload Fix-pakket vs Huidige Code

### Conclusie: Het pakket is grotendeels beter, maar er zitten 2 regressies in die we moeten fixen

---

### Wat is beter in het pakket

**1. Shared modules (4 bestanden)** — Goede opsplitsing. `cors.ts`, `supabase.ts`, `phone.ts`, `webhook-verify.ts` apart houden is schoner dan 1 mega-file.

**2. `whatsapp-webhook`** — Grote verbetering:
- Multi-tenant: lookup op `phone_number_id` uit de payload i.p.v. `.limit(1).single()`
- Duale signature verificatie: Meta native (`X-Hub-Signature-256`) OF SiteJob Connect (`X-Webhook-Secret`) met multi-tenant secret matching
- Shared `findCustomerByPhone()` vervangt 30 regels inline phone-lookup
- Fallback naar eerste config voor legacy tenants (met TODO-marker)

**3. `meta-webhook`** — Verbeterd:
- HMAC-SHA256 signature verificatie op POST (voorheen open voor fake events)
- Postback event handling (Messenger knoppen)
- Error logging per insert i.p.v. silent failures

**4. `meta-api`** — Graph API v21.0 naar v25.0, consistent met webhook field versies. Shared auth.

**5. SQL: Foreign key indexes** — ~50 ontbrekende indexes, `phone_number_id` kolom op `whatsapp_config`. Puur winst.

---

### Wat we moeten fixen in het pakket

**Regressie 1: `supabase.ts` gebruikt `getClaims()` (bestaat niet)**

De shared auth helper (`authenticateRequest()`) gebruikt nog `supabaseUser.auth.getClaims(token)`. Dit is geen standaard Supabase method. Moet `getUser()` worden, zoals we al eerder gefixt hebben in `trigger-email-automation`.

**Regressie 2: RLS migration verwijdert admin-checks**

De `001_fix_rls_policies.sql` herschrijft admin-only policies (invoices, services, user_roles, companies) maar verwijdert de `has_role(auth.uid(), 'admin')` check. Voorbeeld:

```text
HUIDIG (correct):
  USING (company_id = get_my_company_id() AND has_role(auth.uid(), 'admin'))

MIGRATION (regressie):
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = (select auth.uid())))
```

Dit betekent dat *elke* authenticated user in het bedrijf facturen, services en rollen kan verwijderen/wijzigen. Dat is een privilege escalation. We moeten `has_role()` checks behouden op die tabellen.

**Overige aandachtspunten:**
- Het verwijderen van "Service role full access" policies op meta-tabellen is correct (service_role key bypassed RLS sowieso)
- De `(select auth.uid())` performance-optimalisatie is goed, maar we kunnen dat combineren met `get_my_company_id()` dat al SECURITY DEFINER is

---

### Plan: Implementatie in 5 stappen

| # | Wat | Bestanden |
|---|-----|-----------|
| 1 | Maak de 4 shared modules aan | `_shared/cors.ts`, `_shared/supabase.ts` (met getUser fix), `_shared/phone.ts`, `_shared/webhook-verify.ts` |
| 2 | Vervang `whatsapp-webhook/index.ts` met de geuploadde versie (gebruikt shared imports) | `supabase/functions/whatsapp-webhook/index.ts` |
| 3 | Vervang `meta-webhook/index.ts` met de geuploadde versie (signature verificatie + postback handling) | `supabase/functions/meta-webhook/index.ts` |
| 4 | Vervang `meta-api/index.ts` met de geuploadde versie (v25.0 + shared auth) | `supabase/functions/meta-api/index.ts` |
| 5 | SQL migration: foreign key indexes + `phone_number_id` kolom + verwijder "always true" service role policies. RLS admin-checks blijven **behouden** (we nemen alleen de safe delen van de migration over) | Migration SQL |

### Wat we bewust NIET overnemen uit de migration
- De herschreven RLS policies die `has_role()` checks verwijderen
- We nemen wel de `(select auth.uid())` optimalisatie mee, maar alleen voor policies die geen admin-check nodig hebben (profiles, notifications)

