

# Plan: Custom Domain als betaalde module

## Wat er verandert

De custom domain functionaliteit wordt achter een feature flag gezet (`custom_domain`) in het bestaande `enabled_features` systeem. Alleen bedrijven waarvoor een SuperAdmin deze module heeft aangezet, zien het custom domain blok op de instellingenpagina.

## Wijzigingen

### 1. SuperAdminPage: nieuwe feature toevoegen

In de `ALL_FEATURES` array een nieuw item toevoegen:
```ts
{ slug: "custom_domain", label: "Custom Domein" }
```

Dit verschijnt dan als toggle in het SuperAdmin bedrijfsbeheer. Standaard staat het **niet** aan (het zit niet in de default `enabled_features` array van nieuwe bedrijven).

### 2. SettingsPage: custom domain sectie verbergen

Het custom domain invoerveld + DNS-instructies alleen tonen als `enabledFeatures.includes("custom_domain")`. De `enabledFeatures` is al beschikbaar via `useAuth()`.

### 3. Edge function: server-side check

De `manage-custom-domain` edge function checkt ook server-side of het bedrijf de `custom_domain` feature heeft in `enabled_features`, zodat iemand niet via de API het domein kan instellen zonder de module.

### Bestanden

| Bestand | Actie |
|---------|-------|
| `src/pages/SuperAdminPage.tsx` | `custom_domain` toevoegen aan `ALL_FEATURES` |
| `src/pages/SettingsPage.tsx` | Custom domain sectie wrappen in `enabledFeatures.includes("custom_domain")` check |
| `supabase/functions/manage-custom-domain/index.ts` | Server-side check op `enabled_features` |

