

# KVK API Integratie

## Wat wordt gebouwd

KVK (Kamer van Koophandel) lookup: zoek op bedrijfsnaam of KVK-nummer, haal automatisch bedrijfsgegevens op (naam, adres, postcode, plaats, BTW, SBI-codes, coördinaten) en vul formulieren in.

## Benodigde stappen

### 1. Secret toevoegen
`KVK_API_KEY` — ontbreekt nog in de Supabase secrets. Moet eerst worden ingesteld voordat de edge function werkt.

### 2. Edge function: `supabase/functions/kvk-lookup/index.ts`
Exacte kopie van het geüploade bestand. Proxy naar KVK API v2 met 4 actions: `zoeken`, `basisprofiel`, `vestigingsprofiel`, `naamgeving`. JWT-verificatie via Supabase auth header. Nederlandse foutmeldingen voor KVK IPD-codes.

Config.toml entry niet nodig — JWT wordt in code geverifieerd.

### 3. Hook: `src/hooks/useKvkLookup.ts`
Exacte kopie van het geüploade bestand. Exporteert `search()` (autocomplete) en `getCompanyData()` (volledig profiel → Vakflow-schema mapping).

### 4. Integratie in `SettingsCompanyTab.tsx`
- KVK-nummer veld krijgt een "Ophalen" knop ernaast
- Bij klik: `getCompanyData(kvk_number)` → vult naam, adres, postcode, plaats automatisch in
- Bestaande waarden worden overschreven (gebruiker kan daarna nog aanpassen vóór opslaan)

### 5. Integratie in `CompanySignupPage.tsx`
- KVK-nummer veld krijgt dezelfde "Ophalen" knop
- Vult bedrijfsnaam automatisch in na lookup

## Bestanden

| Bestand | Actie |
|---|---|
| `supabase/functions/kvk-lookup/index.ts` | Nieuw — kopie van upload |
| `src/hooks/useKvkLookup.ts` | Nieuw — kopie van upload |
| `src/components/settings/SettingsCompanyTab.tsx` | KVK lookup knop + autofill |
| `src/pages/CompanySignupPage.tsx` | KVK lookup knop + autofill bedrijfsnaam |

