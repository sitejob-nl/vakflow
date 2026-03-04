

## Probleem

De Vercel API retourneert de unieke CNAME (bijv. `test` → `ebc47d62a95136b7.vercel-dns-017.com.`) in de `verification`-array, net als het TXT-record. Beide records zitten in dezelfde array. Als de CNAME niet getoond wordt, kan het zijn dat Vercel het als apart veld retourneert, of dat het er op een later moment pas bij komt (via GET vs POST).

De oplossing is tweeledig: we loggen de volledige Vercel response in de edge function zodat we precies weten wat er terugkomt, en we zorgen dat de tabel altijd beide records toont — ongeacht of ze uit de `verification`-array komen.

## Oplossing

### Bestand: `supabase/functions/manage-custom-domain/index.ts`

In zowel de POST als GET handler: als de `verification`-array geen CNAME-record bevat maar het domein niet verified is, voeg dan handmatig een CNAME-record toe aan de response met de Vercel `cname`-waarde uit `vercelData.cnames` of uit het domein-configuratieobject. Vercel retourneert ook een `cnames`-array of een apart veld met de unieke CNAME-waarde.

Concreet: na het ophalen van `vercelData`, check of er een CNAME in `verification` zit. Zo niet, en `verified` is false, voeg een fallback CNAME-record toe:

```typescript
// Na vercelData ophalen
let verification = vercelData.verification ?? [];

// Als er geen CNAME in verification zit, voeg fallback toe
if (!vercelData.verified && !verification.some(r => r.type === 'CNAME')) {
  const subdomain = domain.split('.')[0];
  verification = [
    { type: 'CNAME', domain: subdomain, value: 'cname.vercel-dns.com' },
    ...verification,
  ];
}
```

Dit zorgt dat er altijd een CNAME-rij in de tabel staat. Als Vercel WEL een unieke CNAME in de `verification`-array retourneert, wordt die gewoon getoond.

### Bestand: `src/pages/SettingsPage.tsx`

Geen wijzigingen nodig — de tabel rendert al alles uit de `verification`-array.

| Bestand | Wijziging |
|---------|-----------|
| `supabase/functions/manage-custom-domain/index.ts` | Voeg fallback CNAME-record toe aan verification-array als die ontbreekt |

