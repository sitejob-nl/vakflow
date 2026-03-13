

# e-Boekhouden Koppeling — Implementatieplan

## Verificatie

- **InvoicesPage.tsx**: e-Boekhouden zit al volledig in alle funcMaps, getSyncStatus, en per-factuur sync. Geen wijzigingen nodig.
- **SettingsAccountingTab.tsx**: e-Boekhouden staat op `enabled: false` (regel 824). Bestaande form fields voor `eboekhouden_ledger_id`, `eboekhouden_template_id`, `eboekhouden_debtor_ledger_id` zijn al aanwezig maar zonder volledige koppelflow.
- **CustomerCreatePage.tsx**: e-Boekhouden auto-sync ontbreekt.

## Wijzigingen

### 1. `SettingsAccountingTab.tsx`

**a) Provider activeren:** `enabled: false` → `enabled: true` voor eboekhouden.

**b) Nieuwe `EBoekhoudenSection` component:**

- **Niet gekoppeld — Stap 1:** Token input + "Verbinding testen" knop
  - Helptekst: "Je vindt je token in e-Boekhouden onder Beheer > Instellingen > API/Koppeling"
  - Slaat token op in `companies.eboekhouden_api_token` + `accounting_provider: "eboekhouden"`, test via `sync-invoice-eboekhouden { action: "test" }`, bij fout reset naar null

- **Niet gekoppeld — Stap 2:** Configuratie dropdowns
  - Factuursjabloon → `{ action: "templates" }` → opslaan in `eboekhouden_template_id`
  - Omzet-grootboekrekening → `{ action: "ledgers" }` → opslaan in `eboekhouden_ledger_id`
  - Debiteurenrekening (optioneel) → `{ action: "debtor-ledgers" }` → opslaan in `eboekhouden_debtor_ledger_id`
  - NB: Template/ledger IDs zijn integers

- **Gekoppeld:** Groene badge + 5 actieknoppen:
  - Contacten synchroniseren → `sync-all-contacts`
  - Contacten ophalen → `pull-contacts`
  - Facturen synchroniseren → `sync-all-invoices`
  - Facturen ophalen → `pull-invoices`
  - Betalingsstatus ophalen → `pull-invoice-status`

- **Ontkoppelen:** AlertDialog → zet `eboekhouden_api_token`, `eboekhouden_template_id`, `eboekhouden_ledger_id`, `eboekhouden_debtor_ledger_id` naar null + `accounting_provider: null`

**c) Render blok:** Voeg `configProvider === "eboekhouden"` toe naast de andere providers.

### 2. `CustomerCreatePage.tsx`

Na de bestaande WeFact/Moneybird checks, toevoegen:

```typescript
if (accountingProvider === "eboekhouden") {
  supabase.functions.invoke("sync-invoice-eboekhouden", {
    body: { action: "sync-customer", customer_id: newCustomer.id },
  }).catch(() => {});
}
```

### 3. `InvoicesPage.tsx`

Geen wijzigingen — e-Boekhouden zit al in alle funcMaps en getSyncStatus.

## Bestanden

| Bestand | Wijziging |
|---|---|
| `src/components/settings/SettingsAccountingTab.tsx` | `enabled: true`, nieuwe `EBoekhoudenSection`, render blok |
| `src/pages/CustomerCreatePage.tsx` | Auto-sync naar e-Boekhouden na aanmaken |

