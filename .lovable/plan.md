

# Admin-componenten voor Exact, e-Boekhouden, WeFact en SnelStart

## Situatie

Moneybird en Rompslomp hebben volledige admin-componenten met tabbed interfaces (contacten, facturen, offertes, producten). De andere vier providers worden afgehandeld met een statische placeholder + ProviderSyncPanel, terwijl hun backends net zo uitgebreid zijn:

| Provider | Backend acties | Admin UI |
|----------|---------------|----------|
| Exact Online | sync/pull contacts, invoices, quotes + grootboek config | Placeholder |
| e-Boekhouden | sync/pull contacts, invoices, quotes + templates/ledgers | Placeholder |
| WeFact | sync/pull contacts, invoices, quotes, products | Placeholder |
| SnelStart | sync relaties, artikelen, facturen, verkooporders, offertes | Placeholder |

## Aanpak

Per provider een admin-component bouwen met hetzelfde tabbed patroon als `RompslompAdmin.tsx`. Elke tab haalt data op uit de lokale Supabase-tabellen (die al gevuld worden door de sync-functies) en toont een zoekbare lijst.

### Componenten

| Bestand | Tabs |
|---------|------|
| `src/components/ExactAdmin.tsx` | Contacten, Facturen, Offertes |
| `src/components/EboekhoudenAdmin.tsx` | Contacten, Facturen |
| `src/components/WefactAdmin.tsx` | Contacten, Facturen, Offertes, Producten |
| `src/components/SnelstartAdmin.tsx` | Relaties, Artikelen, Facturen, Offertes |

Elke component:
- Tabbed wrapper (zelfde stijl als `RompslompAdmin`)
- Per tab: zoekbare tabel met data uit lokale tabellen (customers, invoices, quotes, materials — gefilterd op company_id)
- ProviderSyncPanel onderaan voor handmatige sync
- Externe link-knop naar de provider

### AccountingAdminPage aanpassen

`AccountingAdminPage.tsx` uitbreiden met lazy imports voor alle vier nieuwe componenten, zodat elke provider zijn eigen admin-component rendert in plaats van de placeholder.

### Bestanden

| Bestand | Actie |
|---------|-------|
| `src/components/ExactAdmin.tsx` | Nieuw |
| `src/components/EboekhoudenAdmin.tsx` | Nieuw |
| `src/components/WefactAdmin.tsx` | Nieuw |
| `src/components/SnelstartAdmin.tsx` | Nieuw |
| `src/pages/AccountingAdminPage.tsx` | Lazy imports + provider-switch uitbreiden |

Geen backend-wijzigingen nodig — alle sync-functies bestaan al.

