

# API als schakelbare module + beveiligingsbevestiging

## Beveiliging — Ja, het is veilig

De huidige implementatie is correct beveiligd tegen cross-tenant data:

- Elke API key is gekoppeld aan een `company_id` via de `api_keys` tabel
- Alle queries in `leads-api` gebruiken `.eq("company_id", companyId)` — zowel bij GET, POST, PATCH als DELETE
- De `companyId` komt uit de database-lookup van de gehashte key, niet uit user input
- Rate limiting is per company_id
- Er is geen manier om via de API data van een ander bedrijf op te vragen

## Wijzigingen voor "API" als module

### 1. `src/pages/SuperAdminPage.tsx`
- Voeg `{ slug: "api", label: "API" }` toe aan `ALL_FEATURES` array (regel 59)

### 2. `src/pages/SettingsPage.tsx`
- Voeg `"API Keys": "api"` toe aan `TAB_FEATURE_MAP` zodat de tab alleen zichtbaar is als de "api" feature is ingeschakeld

### 3. `src/hooks/useNavigation.tsx` (indien van toepassing)
- Geen navigatie-item nodig — API Keys is alleen een settings-tab, geen aparte pagina

### 4. `supabase/functions/leads-api/index.ts`
- Na authenticatie: check of het bedrijf de "api" feature heeft ingeschakeld
- Query `companies.enabled_features` en controleer of `"api"` erin zit
- Retourneer 403 als de feature niet is ingeschakeld

### Samenvatting

| Component | Wijziging |
|---|---|
| `SuperAdminPage.tsx` | `"api"` toevoegen aan ALL_FEATURES |
| `SettingsPage.tsx` | Feature-gate op API Keys tab |
| `leads-api/index.ts` | Feature-check na authenticatie |

Kleine wijziging, drie bestanden.

