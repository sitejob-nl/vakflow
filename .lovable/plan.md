

# Plan: Custom Domain Support met Vercel API + Admin-verificatie

## Overzicht

Klanten kunnen hun eigen domein (bijv. `app.bedrijfsnaam.nl`) koppelen via de instellingenpagina. Een nieuwe edge function handelt de Vercel API-integratie af en valideert dat de ingelogde gebruiker admin is van het betreffende bedrijf. De tenant-detectie en lookup worden uitgebreid om custom domains te herkennen.

## 1. Database: `custom_domain` kolom

SQL migratie:
```sql
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS custom_domain text UNIQUE;

DROP VIEW IF EXISTS public.companies_safe;
CREATE VIEW public.companies_safe AS
SELECT
  id, name, slug, address, city, postal_code, phone,
  kvk_number, btw_number, iban, logo_url, brand_color, max_users,
  created_at, enabled_features, accounting_provider,
  email_provider, outlook_email, outlook_client_id, outlook_tenant_id,
  smtp_email, smtp_host, smtp_port,
  rompslomp_company_id, rompslomp_company_name, rompslomp_tenant_id,
  moneybird_administration_id,
  eboekhouden_ledger_id, eboekhouden_template_id, eboekhouden_debtor_ledger_id,
  industry, subcategory, custom_domain
FROM public.companies;
```

## 2. Edge Function: `manage-custom-domain` (nieuw)

Beveiligd met JWT-verificatie + admin-check:
- Haalt `userId` op via `supabase.auth.getUser()`
- Haalt `company_id` op via profiles
- Checkt `has_role(userId, 'admin')` — weigert als de user geen admin is
- Slaat `custom_domain` op in de companies tabel (alleen voor eigen bedrijf)
- Roept Vercel API aan om domein toe te voegen aan het project (`POST /v10/projects/{id}/domains`)
- Ondersteunt ook `GET` om de verificatie-status op te vragen bij Vercel

Vereiste secrets: `VERCEL_TOKEN` en `VERCEL_PROJECT_ID` (moeten nog worden toegevoegd).

## 3. `tenant-lookup` uitbreiden

Naast `?slug=blinkit` ook `?domain=app.bedrijfsnaam.nl` ondersteunen:
- Als `domain` parameter aanwezig: zoek op `custom_domain` kolom
- Retourneert dezelfde publieke velden
- Basis hostname-format validatie

## 4. TenantContext: custom domain fallback

De `detectTenant` functie krijgt een derde pad:

```text
hostname inkomend
  ├─ localhost / .lovable.app / .vercel.app → null (dev)
  ├─ baseDomain in BRAND_DOMAINS → { subdomain, brandIndustry }
  └─ onbekend domein → { customDomain: hostname }
```

Bij `customDomain`: fetch `tenant-lookup?domain=hostname` i.p.v. `?slug=...`. De context krijgt een extra veld `customDomain`.

## 5. SettingsPage: custom domain invoerveld

Onder het bestaande slug-veld in "Bedrijfsgegevens":
- Input voor custom domain (bijv. `app.bedrijfsnaam.nl`)
- Opslaan roept `manage-custom-domain` edge function aan via `supabase.functions.invoke()`
- Na opslaan: toon DNS-instructies in een info-blok:
  - "Stel een CNAME-record in bij je hosting: `app` → `cname.vercel-dns.com`"
- Toon verificatie-status (pending/verified) op basis van Vercel API response

## Bestanden

| Bestand | Actie |
|---------|-------|
| Database migratie | `custom_domain` kolom + view update |
| `supabase/functions/manage-custom-domain/index.ts` | **Nieuw** — JWT + admin check + Vercel API + DB opslag |
| `supabase/config.toml` | `[functions.manage-custom-domain]` toevoegen (verify_jwt = false, validatie in code) |
| `supabase/functions/tenant-lookup/index.ts` | `domain` parameter toevoegen |
| `src/contexts/TenantContext.tsx` | Custom domain fallback in detectie + fetch |
| `src/pages/SettingsPage.tsx` | Custom domain input + DNS instructies + status |

## Vereiste secrets

`VERCEL_TOKEN` en `VERCEL_PROJECT_ID` moeten als Supabase secrets worden toegevoegd voordat de edge function werkt. Ik vraag deze op na goedkeuring van het plan.

