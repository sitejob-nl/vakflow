

## Boekhoud-sync configureerbaar maken + Exact Online provider-fix

6 wijzigingen in één batch.

### 1. Database: companies_safe view uitbreiden
SQL migration: `DROP VIEW` + `CREATE VIEW` met de twee nieuwe kolommen `sync_invoices_to_accounting` en `sync_quotes_to_accounting` toegevoegd aan de bestaande kolomlijst.

### 2. SettingsAccountingTab: Sync toggles
Twee Switch-componenten toevoegen (alleen zichtbaar als `accounting_provider` is ingesteld):
- "Facturen automatisch syncen" → `sync_invoices_to_accounting`
- "Offertes automatisch syncen" → `sync_quotes_to_accounting`
Direct lezen/schrijven via `supabase.from("companies")`.

### 3. InvoiceDialog: Toggle + provider-fix
- Ophalen: `sync_invoices_to_accounting` meelezen naast `accounting_provider`
- Conditie regel 136 wordt: `if (syncInvoices && accountingProvider && newInvoice?.id)`
- Provider-mapping uitbreiden met `accountingProvider === "exact" ? "sync-exact"` en label `"Exact Online"`
- Sync-fout wordt waarschuwings-toast (niet destructive), factuur is wel opgeslagen

### 4. InvoicesPage: Toggle + provider-fix
- `sync_invoices_to_accounting` ophalen bij regel 64
- Auto-sync bij "verzonden" (regel 94-103): alleen als toggle aan staat
- `exact` toevoegen aan de provider-switch: `else if (accountingProvider === "exact") { handleSyncExact(); }`
- Nieuwe `handleSyncExact` functie toevoegen (vergelijkbaar met handleSyncEb, roept `sync-exact` aan met `action: "create-invoice"`)

### 5. QuoteDialog: Toggle + provider-fix
- `sync_quotes_to_accounting` ophalen
- Conditie wordt: `if (syncQuotes && accountingProvider && newQuote?.id)`
- Provider-mapping uitbreiden met `"exact"` → `"sync-exact"` / `"Exact Online"`
- Sync-fout wordt waarschuwings-toast

### 6. Exact Online in provider-mapping (urgent fix)
In alle drie bestanden: `"exact"` toevoegen aan de provider-check, funcName-mapping (`"sync-exact"`), en providerLabel (`"Exact Online"`). Zonder dit valt Exact door naar de e-Boekhouden fallback.

### Bestanden

| Bestand | Wijziging |
|---|---|
| SQL migration | `companies_safe` view + 2 sync kolommen |
| `SettingsAccountingTab.tsx` | Twee sync toggles |
| `InvoiceDialog.tsx` | Toggle check + exact provider + soft error |
| `InvoicesPage.tsx` | Toggle check + exact provider + handleSyncExact |
| `QuoteDialog.tsx` | Toggle check + exact provider + soft error |

