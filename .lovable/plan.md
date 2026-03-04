

# Plan: Industry Config Systeem (5 branches + subcategorieën)

## Overzicht

Een configuratiesysteem bouwen dat terminologie, zichtbare modules en branding dynamisch aanpast per branche en subcategorie. Vijf hoofdbranches met subcategorieën die alleen de labels wijzigen.

## Database

### Nieuwe kolommen op `companies` tabel

```sql
ALTER TABLE companies ADD COLUMN industry text DEFAULT 'technical';
ALTER TABLE companies ADD COLUMN subcategory text DEFAULT 'installation';
```

Geen nieuwe tabellen nodig — de config zit in code (niet in de DB), de keuze van de tenant wordt opgeslagen als twee strings.

## Nieuw bestand: `src/config/industryConfig.ts`

Centraal configuratiebestand met alle 5 branches:

```typescript
export type Industry = "technical" | "cleaning" | "automotive" | "pest" | "landscaping";

export interface IndustryLabels {
  worker: string;        // "Monteur" / "Schoonmaker" / "Mecanicien"
  workOrder: string;     // "Werkbon" / "Schoonmaakbon"
  workOrders: string;    // meervoud
  appointment: string;   // "Afspraak" / "Onderhoudsbeurt"
  asset: string;         // "Object" / "Voertuig"
}

export interface SubcategoryConfig {
  label: string;
  labels: Partial<IndustryLabels>;
}

export interface IndustryConfig {
  name: string;          // "Vakflow" / "CleanFlow" etc.
  icon: string;
  defaultLabels: IndustryLabels;
  subcategories: Record<string, SubcategoryConfig>;
  modules: string[];     // welke modules standaard aan
}
```

Bevat alle 5 branches (technical, cleaning, automotive, pest, landscaping) met hun subcategorieën en labeloverschrijvingen.

## Nieuw bestand: `src/hooks/useIndustryConfig.ts`

Hook die de actieve config ophaalt op basis van `company.industry` + `company.subcategory`:

```typescript
export function useIndustryConfig() {
  // Leest industry + subcategory uit company data (via AuthContext of aparte query)
  // Retourneert gemergede labels (subcategory overschrijft industry defaults)
  return { config, labels, industryName };
}
```

## Wijzigingen in bestaande bestanden

| Bestand | Wat |
|---------|-----|
| `src/config/industryConfig.ts` | **Nieuw** — alle branche/subcategorie definities |
| `src/hooks/useIndustryConfig.ts` | **Nieuw** — hook voor actieve labels |
| `src/contexts/AuthContext.tsx` | `industry` + `subcategory` ophalen uit company en exposen |
| `src/components/OnboardingDialog.tsx` | Stap toevoegen: branche + subcategorie kiezen |
| `src/components/Sidebar.tsx` | Hardcoded "Werkbonnen" → `labels.workOrders` |
| `src/components/MobileNav.tsx` | Idem: "Bonnen" → dynamisch label |
| `src/pages/DashboardPage.tsx` | "Open werkbonnen", "Nieuwe werkbon" → dynamisch |
| `src/pages/WorkOrdersPage.tsx` | Paginatitel dynamisch |
| `src/pages/MonteurDashboardPage.tsx` | "Monteur" → `labels.worker` |
| `src/pages/SettingsPage.tsx` | "Monteur" in rolkeuze → dynamisch |
| `supabase/migrations/...` | `industry` + `subcategory` kolommen |
| `companies_safe` view | Bijwerken met nieuwe kolommen |

## Onboarding flow

Na de welkomstpagina, vóór de bedrijfsgegevens-stap:

1. **Kies je branche** — 5 kaarten met icoon + naam
2. **Kies je specialisatie** — subcategorieën van gekozen branche

De keuze wordt opgeslagen in `companies.industry` en `companies.subcategory`.

## Aanpak voor labels

Niet alle 30+ hardcoded strings in één keer vervangen. Eerste iteratie:
- De 6 meest zichtbare plekken (sidebar, mobile nav, dashboard KPI's, paginatitels, rolkeuze settings, onboarding)
- Overige pagina's in een vervolgronde

