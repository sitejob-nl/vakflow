

## Plan: Abonnementsbeheer per bedrijf (feature flags + gebruikerslimiet)

### Wat wordt gebouwd
Een systeem waarmee de SuperAdmin per bedrijf kan instellen:
1. **Max aantal gebruikers** (gratis inbegrepen bij hun abonnement)
2. **Feature toggles** — welke modules beschikbaar zijn (bijv. WhatsApp, Offertes, E-mail, Facturatie, etc.)

De app respecteert deze limieten: geblokkeerde features verdwijnen uit de sidebar/navigatie, en het uitnodigen van teamleden wordt geblokkeerd als het maximum is bereikt.

---

### Implementatie

**Stap 1 — Database: kolommen toevoegen aan `companies`**

Nieuwe kolommen op de `companies` tabel:
- `max_users` (integer, default 2) — max aantal gebruikers inclusief admin
- `enabled_features` (text[], default alle features) — lijst van ingeschakelde module-slugs

Mogelijke feature-slugs: `dashboard`, `planning`, `customers`, `workorders`, `invoices`, `quotes`, `email`, `whatsapp`, `communication`, `reminders`

**Stap 2 — SuperAdmin: abonnementsinstellingen per bedrijf**

In `SuperAdminPage.tsx` het bedrijf-edit-dialog uitbreiden met:
- Een numeriek veld "Max gebruikers"
- Een checkbox-grid voor alle features (aan/uit per feature)

Dit wordt opgeslagen naar de `companies` tabel.

**Stap 3 — AuthContext: features + max_users doorgeven**

`AuthContext` haalt `max_users` en `enabled_features` op bij login en stelt ze beschikbaar als context-waarden. Bij impersonation worden de waarden van het ge-impersoneerde bedrijf gebruikt.

**Stap 4 — Sidebar/navigatie: features filteren**

`Sidebar.tsx` en `MobileNav.tsx` filteren navigatie-items op basis van `enabledFeatures` uit de context. Uitgeschakelde modules worden niet getoond.

**Stap 5 — Teamleden: gebruikerslimiet afdwingen**

In `SettingsPage.tsx` bij het Teamleden-tab: controleer of het huidige aantal teamleden < `maxUsers` voordat de uitnodiging verzonden wordt. Toon een melding als het limiet bereikt is.

### Bestanden
- Nieuwe migratie: `max_users` + `enabled_features` kolommen
- `src/contexts/AuthContext.tsx` — nieuwe state: `maxUsers`, `enabledFeatures`
- `src/pages/SuperAdminPage.tsx` — edit-dialog uitbreiden
- `src/components/Sidebar.tsx` — feature filtering
- `src/components/MobileNav.tsx` — feature filtering
- `src/pages/SettingsPage.tsx` — gebruikerslimiet check bij uitnodigen

