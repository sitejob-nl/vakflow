

# Status: Industry Config Systeem

## Wat is al gedaan

- `src/config/industryConfig.ts` — alle 5 branches + subcategorieën
- `src/hooks/useIndustryConfig.ts` — hook met gemergede labels
- `src/contexts/AuthContext.tsx` — industry/subcategory uit company
- Database migratie — `industry` + `subcategory` kolommen
- **6 plekken aangepast**: Sidebar, MobileNav, DashboardPage, WorkOrdersPage, MonteurDashboardPage, SettingsPage

## Wat nog ontbreekt

### 1. Onboarding branche-keuze stap
`OnboardingDialog.tsx` heeft nog geen branche/subcategorie selectie. Er moet een stap worden toegevoegd (na "welcome", voor "company") waar de gebruiker:
- Één van de 5 branches kiest (kaarten met icoon + naam)
- Daarna de subcategorie selecteert
- De keuze wordt opgeslagen in `companies.industry` en `companies.subcategory`

### 2. Hardcoded strings in overige bestanden (26 bestanden)
Er staan nog ~430 hardcoded "Monteur"/"Werkbon" strings in bestanden die nog niet zijn aangepast:

| Bestand | Wat aanpassen |
|---------|---------------|
| `Header.tsx` | Titels "Werkbonnen", "Werkbon", "Werkbondetails" |
| `ReportsPage.tsx` | "Werkbonnen", "Actieve monteurs", "Productiviteit per monteur" |
| `AppointmentDialog.tsx` | "Monteur" label |
| `AppointmentDetailSheet.tsx` | "Monteur" referenties |
| `WorkOrderDialog.tsx` | "Werkbon" referenties |
| `WorkOrderDetailPage.tsx` | Paginatitel, labels |
| `CustomerDetailPage.tsx` | "Werkbonnen" tab |
| `QuoteDialog.tsx` | Eventuele werkbon-referenties |
| `InvoiceDialog.tsx` | Werkbon-gerelateerde labels |
| `WhatsApp automations/hooks` | Trigger labels ("Werkbon afgerond") |
| `useAutoMessageSettings.ts` | "Werkbon samenvatting" |

### 3. Uploaded architectuur-bestand
Het geüploade `vakflow-architectuur-2.jsx` is een visuele architectuurpagina (React component) met branche-specifieke demo's, AI-voorbeelden en tenant-overzichten. Dit is een presentatie/documentatie component, niet direct nodig voor de functionaliteit.

## Aanbevolen volgorde

1. **Onboarding branche-keuze** — kritisch, want zonder dit kunnen nieuwe tenants geen branche kiezen
2. **Header.tsx** — meest zichtbaar na de al-aangepaste plekken
3. **ReportsPage.tsx** — veel hardcoded strings
4. **Overige dialogen en hooks** — in batch

