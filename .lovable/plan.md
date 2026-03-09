

# Plan: Exact Online Grootboekrekening-keuze in Instellingen

## Samenvatting
Na het koppelen van Exact Online moet de gebruiker een omzet-grootboekrekening kiezen en optioneel een verkoopjournaal-code instellen. Zonder deze instelling faalt de factuur-sync.

## Database
- Voeg kolom `gl_revenue_id` (text, nullable) toe aan `exact_config` — slaat de Exact GLAccount GUID op

(`journal_code` bestaat al in de tabel)

## Edge Function: sync-exact
- Voeg een nieuw `action: "fetch-gl-accounts"` toe aan de switch in `sync-exact/index.ts`
- Haalt GLAccounts op via Exact API: `financial/GLAccounts?$select=ID,Code,Description&$filter=Type eq 20` (type 20 = omzet)
- Retourneert `{ accounts: [{ id, code, description }] }`

## Frontend: ExactOnlineSection in SettingsAccountingTab
Na het "connected" blok (regel 89-103), voeg toe:
1. **useEffect** die bij `isConnected` de GL-accounts ophaalt via `supabase.functions.invoke("sync-exact", { body: { action: "fetch-gl-accounts" } })`
2. **Dropdown** "Omzet-grootboekrekening" met opgehaalde accounts (toont `code - description`)
3. **Input** "Verkoopjournaal code" (default "70")
4. Bij wijziging: direct opslaan naar `exact_config` via `supabase.from("exact_config").update({ gl_revenue_id, journal_code })`
5. Laad huidige waarden uit de `exact_config` query (breid bestaande select uit met `gl_revenue_id, journal_code`)

## Factuur-sync validatie
In `sync-exact` bij `sync-invoices` en `sync-single-invoice`: controleer of `config.gl_revenue_id` is ingesteld. Zo niet, return een duidelijke foutmelding: "Stel eerst een omzet-grootboekrekening in via Instellingen > Boekhouding".

Voeg `GLAccount: config.gl_revenue_id` toe aan elke `SalesInvoiceLine`.

## Bestanden

| Bestand | Wijziging |
|---------|-----------|
| Migration | `ALTER TABLE exact_config ADD COLUMN gl_revenue_id text` |
| `supabase/functions/sync-exact/index.ts` | Nieuw action `fetch-gl-accounts` + validatie in invoice sync |
| `src/components/settings/SettingsAccountingTab.tsx` | GL-dropdown + journaal-input in ExactOnlineSection |

