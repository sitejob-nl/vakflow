

# WeFact Koppeling — Implementatieplan

## Wijzigingen

### 1. `SettingsAccountingTab.tsx` — Nieuwe `WeFactSection`

Vervang het huidige simpele token-blok door een volledige sectie:

**Niet-gekoppeld**: API key input + "Koppelen" knop → roept `sync-wefact { action: "test", token }` aan → bij succes: sla op in `companies.wefact_api_key` + zet `accounting_provider: "wefact"`

**Gekoppeld**:
- Groene "Gekoppeld" badge
- Sync toggles (facturen + offertes)
- 5 actieknoppen met loading states:
  - Contacten synchroniseren → `{ action: "sync-contacts" }`
  - Producten synchroniseren → `{ action: "sync-products" }`
  - **Producten ophalen uit WeFact** → `{ action: "pull-products" }`
  - Facturen synchroniseren → `{ action: "sync-invoices" }`
  - Betalingsstatus ophalen → `{ action: "pull-invoice-status" }`
- Toast met resultaat (synced/skipped/errors)
- "Ontkoppelen" met AlertDialog → `wefact_api_key: null, accounting_provider: null` (laat wefact_id/debtor_code staan)

### 2. `InvoicesPage.tsx` — Per-factuur WeFact sync

Voeg in het actiemenu toe: "Synchroniseer naar WeFact" als `provider === "wefact"` en `!invoice.wefact_id` → roept `sync-wefact { action: "create-invoice", invoice_id }` aan.

### 3. `CustomerCreatePage.tsx` — Auto-sync klant

Na succesvolle `createCustomer.mutateAsync()`: check `accounting_provider === "wefact"` (query uit `companies`), zo ja: fire-and-forget `sync-wefact { action: "sync-customer", customer_id }`.

## Bestanden

| Bestand | Wijziging |
|---|---|
| `src/components/settings/SettingsAccountingTab.tsx` | Nieuwe WeFactSection met test/connect, 5 sync-knoppen, ontkoppelen |
| `src/pages/InvoicesPage.tsx` | Per-factuur WeFact sync knop |
| `src/pages/CustomerCreatePage.tsx` | Auto-sync naar WeFact na aanmaken |

