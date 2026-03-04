

# Plan: Subdomain-based Tenant Routing met Multi-Brand Support

## Overzicht

Client-side subdomain detectie met ondersteuning voor meerdere brand-domeinen (vakflow.nl, wasflow.nl, groenflow.nl). Een publieke Edge Function voor tenant-lookup voor login. TenantContext app-breed beschikbaar, niet alleen op AuthPage. Post-login validatie dat de user bij de juiste tenant hoort.

## 1. Edge Function: `tenant-lookup`

**Nieuw bestand:** `supabase/functions/tenant-lookup/index.ts`

- Accepteert `GET ?slug=blinkit`
- Gebruikt service role key om RLS te bypassen
- Retourneert **uitsluitend publieke velden**: `{ name, logo_url, brand_color, industry, subcategory }`
- Geen user-lijsten, geen financiele data, geen interne config
- `verify_jwt = false` in config.toml

## 2. TenantContext (app-breed)

**Nieuw bestand:** `src/contexts/TenantContext.tsx`

Subdomain-detectie met multi-brand support:

```typescript
const BRAND_DOMAINS: Record<string, Industry> = {
  'vakflow.nl': 'technical',
  'wasflow.nl': 'cleaning',
  'groenflow.nl': 'landscaping',
  // autoflow.nl en pestflow.nl later toe te voegen
};

function detectTenant(hostname: string) {
  // Skip localhost, lovable.app previews
  if (hostname === 'localhost' || hostname.endsWith('.lovable.app')) return null;

  const parts = hostname.split('.');
  const baseDomain = parts.slice(-2).join('.'); // "vakflow.nl"
  const subdomain = parts.length >= 3 ? parts[0] : null;

  if (!subdomain || subdomain === 'app' || subdomain === 'www') return null;
  
  const brandIndustry = BRAND_DOMAINS[baseDomain] ?? null;
  return { subdomain, brandIndustry, baseDomain };
}
```

Context exposeert:
- `tenant`: opgehaalde tenant-data (naam, logo, kleur, industry)
- `tenantSlug`: het subdomain
- `brandIndustry`: de industry op basis van het domein (fallback als tenant geen industry heeft)
- `isTenantSite`: boolean
- `loading`: boolean

**Belangrijk:** TenantContext wraps de hele app in `App.tsx`, **buiten** AuthProvider, zodat het zowel op AuthPage als in AppLayout beschikbaar is.

## 3. AuthPage branding

`src/pages/AuthPage.tsx` wijzigingen:
- Gebruikt `useTenant()` om tenant-data op te halen
- Toont tenant-logo i.p.v. Vakflow-logo als er een tenant is
- Past brand_color toe als CSS variabele op de login-card
- Toont bedrijfsnaam: "Log in bij Blink It"

## 4. Post-login tenant validatie

In `AuthContext.tsx`, na succesvolle login op een tenant-subdomain:
- Vergelijk `realCompanyId` met de tenant's company ID
- Als ze niet matchen: toon foutmelding "Dit account hoort niet bij dit bedrijf" en log automatisch uit
- RLS vangt het in de database op, maar de UI geeft een duidelijke foutmelding

## 5. AppLayout integratie

`AppLayout.tsx` gebruikt TenantContext als bron voor brand_color wanneer beschikbaar (tenant overschrijft company data voor de visuele laag). De industry/subcategory uit TenantContext voedt dezelfde `useIndustryConfig` hook.

## Bestanden

| Bestand | Actie |
|---------|-------|
| `supabase/functions/tenant-lookup/index.ts` | **Nieuw** — publieke slug-lookup |
| `supabase/config.toml` | Toevoegen `[functions.tenant-lookup]` |
| `src/contexts/TenantContext.tsx` | **Nieuw** — subdomain detectie + tenant state + multi-brand |
| `src/App.tsx` | TenantProvider wrappen rond AuthProvider |
| `src/pages/AuthPage.tsx` | Tenant branding op login pagina |
| `src/contexts/AuthContext.tsx` | Post-login tenant validatie |
| `src/components/AppLayout.tsx` | TenantContext brand color als primaire bron |

## Geen database wijzigingen nodig

De `companies` tabel heeft al `slug`, `logo_url`, `brand_color`, `industry`, `subcategory`. De Edge Function leest direct uit deze tabel.

