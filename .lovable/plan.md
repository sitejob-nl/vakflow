

# Fix: Toon Vercel-specifieke DNS-records in custom domain UI

## Probleem

De Vercel API retourneert specifieke DNS-verificatierecords (CNAME met unieke waarde + TXT-record) wanneer een domein aan een ander Vercel-account is gekoppeld. De huidige UI toont alleen een generieke instructie ("stel CNAME in naar cname.vercel-dns.com"), maar negeert de `verification`-array die Vercel teruggeeft.

Uit je screenshot blijkt dat Vercel deze records vereist:
- **CNAME** `test` → `ebc47d62a95136b7.vercel-dns-017.com.`
- **TXT** `_vercel` → `vc-domain-verify=test.sitejob.nl,ae91d7df48575fe566fc`

## Oplossing

### 1. Edge Function (`manage-custom-domain/index.ts`)
De `verification`-array wordt al doorgegeven in de response (`vercelData.verification`). Hier hoeft niets te veranderen.

### 2. Settings UI (`src/pages/SettingsPage.tsx`)
Update de DNS-instructiesectie (regels ~1017-1041) om de `verification`-array uit `customDomainStatus` te tonen:

- Als `customDomainStatus.verification` bestaat en niet leeg is → toon elke record (type, name, value) in een overzichtelijke tabel/lijst
- Als er geen verification-array is → toon de huidige generieke CNAME-instructie als fallback
- Voeg een "Kopieer"-knop toe per record-waarde voor gebruiksgemak

**Voorbeeldweergave:**

```text
┌─────────────────────────────────────────────────────┐
│ ℹ DNS instellen                                     │
│                                                     │
│ Stel de volgende records in bij je domeinprovider:   │
│                                                     │
│  Type   │ Name     │ Value                    [📋]  │
│  CNAME  │ test     │ ebc47d62...dns-017.com.  [📋]  │
│  TXT    │ _vercel  │ vc-domain-verify=...     [📋]  │
│                                                     │
│ SSL wordt automatisch geregeld na verificatie.       │
│ ⚠ Wacht op DNS-verificatie                          │
└─────────────────────────────────────────────────────┘
```

| Bestand | Wijziging |
|---------|-----------|
| `src/pages/SettingsPage.tsx` | Toon `verification`-records dynamisch, met kopieerknoppen en fallback naar generieke CNAME |

