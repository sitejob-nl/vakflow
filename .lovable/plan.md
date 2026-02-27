

## Plan: SuperAdmin dashboard omzetten naar SaaS-schaal

Het huidige dashboard haalt **alle data client-side** op en doet client-side filtering — dat schaalt niet naar 1000+ bedrijven. Daarnaast toont het financiele data (omzet, facturen) die niet relevant is voor platformbeheer.

### Wijzigingen in `src/components/SuperAdminStats.tsx`

1. **Verwijder alle financiele data**:
   - Verwijder `invoices` query uit `Promise.all`
   - Verwijder `totalInvoices`, `totalRevenue`, `revenue` uit interface en state
   - Verwijder KPI's "Facturen" en "Omzet (betaald)"
   - Verwijder "Omzet per bedrijf" bar chart
   - Verwijder "Facturen" en "Omzet" kolommen uit per-bedrijf tabel

2. **Schaalbaarheid fixes**:
   - Gebruik `.select("company_id", { count: "exact", head: true })` voor totalen in plaats van alle rijen ophalen en client-side tellen (Supabase 1000 row limit)
   - Gebruik `count` queries per tabel voor KPI's
   - Verwijder de per-bedrijf breakdown tabel (dupliceert de Bedrijven-tab en schaalt niet)

3. **KPI grid**: van 6 naar 4 kolommen (`lg:grid-cols-4`): Bedrijven, Gebruikers, Klanten, Werkbonnen

4. **Groei-chart aanpassen**: voeg "Nieuwe bedrijven" als lijn toe (belangrijkste SaaS metric)

### Wijzigingen in `src/pages/SuperAdminPage.tsx`

5. **Bedrijventabel schaalbaarheid**: de `fetchCompanies` functie haalt ook alle customers/profiles/work_orders op en filtert client-side — vervang door `count` queries met `.eq("company_id", id)` per bedrijf, of gebruik de bestaande head-count pattern

### Resultaat
- Geen financiele bedrijfsdata meer zichtbaar
- Dashboard werkt met 1000+ bedrijven door server-side counts
- Focus op platformmetrics: groei, adoptie, activiteit

