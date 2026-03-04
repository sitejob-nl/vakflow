

## Probleem

Vercel retourneert het `domain`-veld als de volledige hostnaam, bijv. `_vercel.sitejob.nl`. Maar bij GoDaddy (en de meeste DNS-providers) wordt het domein automatisch toegevoegd aan de naam. Dus als je `_vercel.sitejob.nl` invult, wordt het `_vercel.sitejob.nl.sitejob.nl` — dubbel en fout.

Vercel zelf toont in hun dashboard alleen het korte deel: `_vercel` en `test`. De app moet dit ook doen.

## Oplossing

**Bestand:** `src/pages/SettingsPage.tsx` (regel ~1071)

Strip het basisdomain van het `domain`-veld voordat het wordt weergegeven. Bijv.:
- `_vercel.sitejob.nl` → `_vercel`  
- `test.sitejob.nl` → `test`

Logica: neem `record.domain`, verwijder het suffix dat overeenkomt met het ingevoerde custom domain (`.sitejob.nl`), en toon alleen het overblijvende deel.

```typescript
// Huidige weergave:
{record.domain}

// Nieuw:
{record.domain.replace(`.${customDomain}`, '') || record.domain}
```

Zo matcht de weergave met wat Vercel toont en wat DNS-providers verwachten.

| Bestand | Wijziging |
|---------|-----------|
| `src/pages/SettingsPage.tsx` | Strip basisdomain van `record.domain` in verificatie-tabel |

