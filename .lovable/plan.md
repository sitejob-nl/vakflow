

## Plan: Dynamische CNAME-waarde uit Vercel API gebruiken

### Probleem
De edge function hardcodet `cname.vercel-dns.com` als fallback CNAME-waarde. Vercel deelt tegenwoordig project-specifieke CNAME-adressen uit (bijv. `ebc47d62a95136b7.vercel-dns-017.com`). Die unieke waarde moet uit de Vercel API response gelezen worden.

### Wijziging: `supabase/functions/manage-custom-domain/index.ts`

**POST handler (regels 82-89):** Vervang de hardcoded fallback door de dynamische waarde uit `vercelData`:

```typescript
let verification = vercelData.verification ?? [];
const cnameTarget = vercelData.cnames?.[0] ?? vercelData.configuredBy ?? 'cname.vercel-dns.com';
if (!vercelData.verified && !verification.some((r: any) => r.type === 'CNAME')) {
  const subdomain = domain.split('.')[0];
  verification = [
    { type: 'CNAME', domain: subdomain, value: cnameTarget },
    ...verification,
  ];
}
```

**GET handler (regels 133-140):** Zelfde wijziging — gebruik `vercelData.cnames?.[0] ?? vercelData.configuredBy` in plaats van de hardcoded string.

Beide handlers behouden `'cname.vercel-dns.com'` als laatste fallback voor het geval Vercel geen van beide velden retourneert.

| Bestand | Wijziging |
|---------|-----------|
| `supabase/functions/manage-custom-domain/index.ts` | POST + GET: dynamische CNAME-waarde uit Vercel response i.p.v. hardcoded |

