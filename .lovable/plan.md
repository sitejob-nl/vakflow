

## Analyse van het SaaS-Gereedheidsrapport

### Wat is al opgelost (vorige iteratie)
- Edge Functions JWT-validatie: `authenticateRequest()` gestandaardiseerd, `getClaims()` verwijderd
- Shared crypto module (`_shared/crypto.ts`) met AES-256-GCM + HMAC
- OAuth state HMAC-signing (Outlook)
- Multi-tenant scoping fixes (whatsapp-config, whatsapp-send)
- `CRON_SECRET` voor reminder-scan

### Wat nu nog actie vereist

---

#### Stap 1: RLS-policies van `public` naar `authenticated` role (KRITIEK)

**12 tabellen** hebben policies op de `public` role in plaats van `authenticated`. Dit moet per policy: drop + recreate met `TO authenticated`.

Betreffende tabellen:
- `asset_maintenance_logs` (4 policies)
- `assets` (4 policies)
- `companies` (2 policies: SELECT + Super admin UPDATE)
- `email_templates` (4 policies)
- `materials` (4 policies)
- `meta_config` (4 policies)
- `meta_conversations` (3 policies)
- `meta_leads` (4 policies)
- `meta_page_posts` (4 policies)
- `time_entries` (4 policies)
- `work_order_materials` (policies op public)
- Mogelijk `whatsapp_messages`, `work_orders` (moet geverifieerd worden)

**Aanpak**: Eén migratie die alle betrokken policies dropt en opnieuw aanmaakt met `TO authenticated`.

---

#### Stap 2: RLS InitPlan-optimalisatie (HOOG)

Alle policies die `get_my_company_id()`, `auth.uid()`, `has_role(auth.uid(), ...)`, of `is_super_admin()` gebruiken moeten gewrapped worden met `(select ...)` om per-row evaluatie te voorkomen.

Voorbeeld:
```sql
-- Was:
company_id = get_my_company_id()
-- Wordt:
company_id = (select get_my_company_id())

-- Was:
has_role(auth.uid(), 'admin'::app_role)
-- Wordt:
has_role((select auth.uid()), 'admin'::app_role)
```

Dit raakt **alle ~120 policies** over alle 30 tabellen. Wordt gecombineerd met Stap 1 in dezelfde migratie.

---

#### Stap 3: Dubbele UPDATE-policies op `companies` samenvoegen (HOOG)

Twee permissive UPDATE-policies:
1. "Admins can update own company" — `id = get_my_company_id() AND has_role(auth.uid(), 'admin')`
2. "Super admins can update companies" — `is_super_admin()`

Samenvoegen tot één policy met OR-conditie.

---

#### Stap 4: Leaked Password Protection (WAARSCHUWING)

Dit is een **Supabase Dashboard-instelling**, geen code-wijziging. Ik geef je de link om dit in te schakelen.

---

### Buiten scope (handmatig / later)
- **Auth DB connection strategy** (percentage-based): Supabase Pro plan instelling, niet via migratie
- **Credentials encryptie in companies-tabel**: De `_shared/crypto.ts` module is er al. De Edge Functions die credentials lezen (send-email, outlook-*, rompslomp-*, etc.) gebruiken al decrypt. Verdere verplaatsing naar een apart model is een grotere refactor voor later.
- **Rate limiting op Edge Functions**: Vereist externe tooling (Cloudflare, custom middleware)

### Uitvoering

Eén grote migratie die stap 1, 2 en 3 combineert: alle ~120 policies worden gedropt en opnieuw aangemaakt met:
- `TO authenticated` (i.p.v. `public`)
- `(select ...)` wrappers rond alle function calls

