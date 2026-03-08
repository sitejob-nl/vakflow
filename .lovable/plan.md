

# Custom velden voor objecten — per bedrijf configureerbaar

Database is klaar (`companies.asset_field_config` en `assets.custom_fields` bestaan al). `companies_safe` view bevat al `asset_field_config`. Alleen frontend-wijzigingen nodig.

## 1. `src/hooks/useAssets.ts` — Asset type uitbreiden

Voeg `custom_fields: Record<string, any> | null` toe aan de `Asset` interface (regel 6-34). Geen query-wijzigingen nodig — Supabase retourneert het al.

## 2. `src/components/settings/SettingsAssetFieldsTab.tsx` (nieuw)

Configurator voor `asset_field_config`:
- Laad huidige config via `supabase.from("companies").select("asset_field_config").eq("id", companyId).single()`
- Lijst van velddefinities, elk met: label input, type select (text/number/date/select/boolean), opties-invoer (alleen bij select, komma-gescheiden), verwijder-knop
- "Veld toevoegen" knop
- Key auto-generatie: `label.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_")`
- Validatie: geen dubbele keys, label verplicht, options verplicht bij select
- Opslaan → `supabase.from("companies").update({ asset_field_config }).eq("id", companyId)`

## 3. `src/pages/SettingsPage.tsx` — Tab toevoegen

- Voeg "Objectvelden" toe aan `BASE_TABS` (na "Materialen")
- Voeg `"Objectvelden": "assets"` toe aan `TAB_FEATURE_MAP`
- Lazy import + case in `renderTab()`

## 4. `src/components/AssetDialog.tsx` — Dynamische velden renderen

- Laad `asset_field_config` via query op `companies` (of `companies_safe`)
- Na bestaande velden, sectie "Extra velden" (alleen als config.length > 0)
- Per velddefinitie: render juiste input-type
- Waarden lezen/schrijven via `form.custom_fields[field.key]` met `setCustomField` helper
- Bij opslaan: `custom_fields` mee in payload

## 5. `src/pages/AssetsPage.tsx` — Custom velden in detail sheet

- Laad `asset_field_config` via query
- In detail sheet na standaard info: toon custom_fields als key-value grid
- Boolean → "Ja"/"Nee", date → `format(new Date(val), "d MMM yyyy", { locale: nl })`, lege waarden overslaan

## Bestanden

| Bestand | Actie |
|---|---|
| `src/hooks/useAssets.ts` | `custom_fields` in Asset type |
| `src/components/settings/SettingsAssetFieldsTab.tsx` | Nieuw — configurator |
| `src/pages/SettingsPage.tsx` | Tab toevoegen |
| `src/components/AssetDialog.tsx` | Dynamische velden |
| `src/pages/AssetsPage.tsx` | Custom velden in detail sheet |

## Volgorde
1. useAssets type
2. SettingsAssetFieldsTab
3. SettingsPage tab
4. AssetDialog velden
5. AssetsPage detail

