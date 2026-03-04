

## Probleem gevonden

**De e-Boekhouden token wordt opgeslagen in de `companies` tabel, maar uitgelezen uit de `profiles` tabel.**

### Oorzaak

- `save-smtp-credentials` slaat de versleutelde token op in `companies.eboekhouden_api_token` (regel 74-78)
- `sync-invoice-eboekhouden` leest de token uit `profiles.eboekhouden_api_token` (regel 391-398)
- De token staat dus nooit in `profiles`, waardoor de fout "e-Boekhouden API-token niet ingesteld" altijd optreedt

### Oplossing

**1 bestand aanpassen: `supabase/functions/sync-invoice-eboekhouden/index.ts`**

De token-ophaal logica wijzigen om de `eboekhouden_api_token` uit de `companies` tabel te lezen (via `company_id` uit het profiel), in plaats van uit `profiles`. Dit is consistent met hoe de SettingsPage het opslaat en hoe andere providers (Rompslomp, Moneybird) al werken.

Concreet:
- Haal eerst `company_id` op uit `profiles`
- Haal daarna `eboekhouden_api_token` + template/ledger config op uit `companies` in een enkele query
- Verwijder de dubbele company-config query die nu al op regel 406-418 staat (wordt overbodig)

