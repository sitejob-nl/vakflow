

## Analyse: WhatsApp tenant registratie faalt voor tweede bedrijf

### Probleem

De `whatsapp-register` Edge Function stuurt voor elk bedrijf dezelfde `webhook_url` naar het Connect platform:

```
https://sigzpqwnavfxtvbyqvzj.supabase.co/functions/v1/whatsapp-webhook
```

Als Connect de webhook_url als uniek beschouwt, wordt het tweede bedrijf geweigerd. Daarnaast komt de `name` parameter uit `profiles.company_name` (die mogelijk leeg of identiek is voor meerdere bedrijven), in plaats van uit de `companies` tabel.

### Oplossing

**1. Maak de webhook_url uniek per bedrijf** door de `company_id` als query parameter mee te sturen:

In `src/pages/SettingsPage.tsx`:
```typescript
const webhookUrl = `https://sigzpqwnavfxtvbyqvzj.supabase.co/functions/v1/whatsapp-webhook?company_id=${companyId}`;
```

**2. Gebruik de company naam uit de companies tabel** in plaats van `profiles.company_name` (die een legacy-veld is):

In `src/pages/SettingsPage.tsx` - vervang de profile lookup door het al beschikbare `companyId` en haal de naam op uit `companies_safe`.

**3. Verwerk de company_id query parameter in de whatsapp-webhook** zodat inkomende berichten correct gerouteerd worden als de URL deze bevat (bestaande routing op `phone_number_id` blijft intact als fallback).

In `supabase/functions/whatsapp-webhook/index.ts` - lees optioneel `company_id` uit de URL query params.

| Bestand | Wijziging |
|---------|-----------|
| `src/pages/SettingsPage.tsx` | Unieke webhook_url met company_id; bedrijfsnaam uit companies_safe |
| `supabase/functions/whatsapp-webhook/index.ts` | Optionele company_id uit query params ondersteunen |

