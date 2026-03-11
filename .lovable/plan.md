

# Exact Online: GL-rekening & Dagboek configuratie via dropdowns

## Probleem
De `sync-exact` functie vereist een `gl_revenue_id` en `journal_code` in de `exact_config` tabel, maar er is nergens in de UI een manier om deze in te stellen. De gebruiker krijgt daarom een 400-error bij het syncen van facturen.

## Oplossing
Voeg twee dropdown-selectors toe aan de Exact Online sectie in **SettingsAccountingTab** (wanneer Exact is gekoppeld). De dropdowns laden hun opties live vanuit de Exact Online API via de bestaande `exact-api` edge function.

### Wat wordt gebouwd

**1. ExactOnlineSection uitbreiden** (`src/components/settings/SettingsAccountingTab.tsx`)

Wanneer de connectie actief is, toon twee extra dropdowns:
- **Omzet-grootboekrekening** — haalt `financial/GLAccounts` op met filter `Type eq 110` (revenue accounts)
- **Verkoopjournaal** — haalt `financial/Journals` op met filter `Type eq 20` (sales journals)

De data wordt opgehaald via `supabase.functions.invoke("exact-api", { body: { divisionId, endpoint, method: "GET" } })`. De `divisionId` komt uit de bestaande `exact_online_connections` query.

Bij selectie worden de waarden direct opgeslagen naar de `exact_config` tabel. Als er nog geen `exact_config` row bestaat voor het bedrijf, wordt er een aangemaakt (upsert).

**2. Laadstatus & fallback**
- Skeleton/spinner terwijl GL accounts en journals laden
- Foutmelding als de API-call faalt (bijv. "Kon grootboekrekeningen niet ophalen")
- Huidige waarden worden bij mount geladen uit `exact_config`

### Technische details

```text
┌─ SettingsAccountingTab ──────────────────────┐
│  Provider: Exact Online                       │
│  ┌─ ExactOnlineSection ─────────────────────┐ │
│  │  ✓ Exact Online gekoppeld                │ │
│  │  Administratie: BedrijfX                 │ │
│  │                                          │ │
│  │  Omzet-grootboekrekening:  [▼ dropdown]  │ │
│  │  Verkoopjournaal:          [▼ dropdown]  │ │
│  │                                          │ │
│  │  [Status vernieuwen] [Ontkoppelen]       │ │
│  └──────────────────────────────────────────┘ │
└───────────────────────────────────────────────┘
```

- GL Accounts endpoint: `financial/GLAccounts?$filter=Type eq 110&$select=ID,Code,Description`
- Journals endpoint: `financial/Journals?$filter=Type eq 20&$select=ID,Code,Description`
- Opslaan: `upsert` naar `exact_config` tabel met `company_id`, `gl_revenue_id`, `journal_code`
- Division ID wordt opgehaald uit `exact_online_connections` (reeds beschikbaar in de component)

### Bestanden

| Bestand | Wijziging |
|---|---|
| `src/components/settings/SettingsAccountingTab.tsx` | ExactOnlineSection uitbreiden met GL/journal dropdowns |

