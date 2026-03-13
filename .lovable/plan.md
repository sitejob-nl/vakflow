

# Rompslomp Koppeling — Implementatieplan

## Verificatie

- **InvoicesPage.tsx**: Rompslomp zit al volledig in alle funcMaps, getSyncStatus, pullFuncMap, en per-factuur sync. Geen wijzigingen nodig.
- **SettingsAccountingTab.tsx**: Rompslomp staat op `enabled: false`. Geen `RompslompSection` component. Bestaande form fields voor `rompslomp_company_name`, `rompslomp_company_id`, `rompslomp_tenant_id` zijn al aanwezig.
- **CustomerCreatePage.tsx**: Rompslomp auto-sync ontbreekt (WeFact, Moneybird, e-Boekhouden zijn er al).

## Wijzigingen

### 1. `SettingsAccountingTab.tsx`

**a) Provider activeren:** `enabled: false` → `enabled: true` voor rompslomp.

**b) Nieuwe `RompslompSection` component** (zelfde patroon als MoneybirdSection):

- **Stap 1:** Token input + "Bedrijven ophalen" → `sync-rompslomp { action: "auto-detect", token }` → dropdown met bedrijven
- **Stap 2:** Bedrijf selecteren + "Koppelen" → slaat `rompslomp_api_token`, `rompslomp_company_id`, `rompslomp_company_name`, `accounting_provider: "rompslomp"` op
- **Gekoppeld:** Groene badge + bedrijfsnaam + 6 actieknoppen:
  - Contacten synchroniseren → `sync-contacts`
  - Contacten ophalen → `pull-contacts`
  - Facturen synchroniseren → `sync-invoices`
  - Facturen ophalen → `pull-invoices`
  - Offertes synchroniseren → `sync-quotes`
  - Betalingsstatus ophalen → `pull-invoice-status`
- **Ontkoppelen:** AlertDialog → `rompslomp_api_token: null`, `rompslomp_company_id: null`, `rompslomp_company_name: null`, `accounting_provider: null`

**c) Render blok:** Voeg `configProvider === "rompslomp"` toe naast de andere providers.

### 2. `CustomerCreatePage.tsx`

Na de bestaande e-Boekhouden check, toevoegen:
```typescript
if (accountingProvider === "rompslomp") {
  supabase.functions.invoke("sync-rompslomp", {
    body: { action: "sync-customer", customer_id: newCustomer.id },
  }).catch(() => {});
}
```

### 3. `InvoicesPage.tsx`

Geen wijzigingen — Rompslomp zit al in alle funcMaps en getSyncStatus.

## Bestanden

| Bestand | Wijziging |
|---|---|
| `src/components/settings/SettingsAccountingTab.tsx` | `enabled: true`, nieuwe `RompslompSection`, render blok |
| `src/pages/CustomerCreatePage.tsx` | Auto-sync naar Rompslomp |

