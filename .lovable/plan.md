

# Moneybird Koppeling — Implementatieplan

## Verificatie

- **InvoicesPage.tsx**: Moneybird zit al volledig in `funcMap` (regel 200) en `getSyncStatus` (regel 29). Geen wijzigingen nodig — bevestigd.
- **SettingsAccountingTab.tsx**: Moneybird staat op `enabled: false` (regel 576). Geen `MoneybirdSection` component aanwezig. Er is wel een `moneybird_administration_id` save in het generieke form (regel 693).

## Wijzigingen

### 1. `SettingsAccountingTab.tsx`

**a) Provider activeren:** `enabled: false` → `enabled: true` voor moneybird in de PROVIDERS array.

**b) Nieuwe `MoneybirdSection` component** (zelfde patroon als `WeFactSection`):

- **Niet gekoppeld — Stap 1:** Token input + "Administraties ophalen" knop → `sync-moneybird { action: "auto-detect", token }` → toont dropdown met beschikbare administraties
- **Niet gekoppeld — Stap 2:** Administratie selecteren + "Koppelen" → slaat `moneybird_api_token`, `moneybird_administration_id`, `accounting_provider: "moneybird"` op in `companies`
- **Gekoppeld:** Groene badge + 6 actieknoppen (elk met loading spinner):
  - Contacten synchroniseren → `sync-contacts`
  - Contacten ophalen → `pull-contacts`
  - Producten synchroniseren → `sync-products`
  - Facturen synchroniseren → `sync-invoices`
  - Offertes synchroniseren → `sync-quotes`
  - Betalingsstatus ophalen → `pull-invoice-status`
- **Ontkoppelen:** AlertDialog → zet `moneybird_api_token: null`, `moneybird_administration_id: null`, `accounting_provider: null`

**c) Render blok:** Voeg `configProvider === "moneybird"` toe na het wefact-blok (regel 890) met `<MoneybirdSection>`.

### 2. `CustomerCreatePage.tsx`

Na de bestaande WeFact auto-sync (regel 96-100), toevoegen:

```typescript
if (accountingProvider === "moneybird") {
  supabase.functions.invoke("sync-moneybird", {
    body: { action: "sync-customer", customer_id: newCustomer.id },
  }).catch(() => {});
}
```

### 3. `InvoicesPage.tsx`

Geen wijzigingen — moneybird zit al in funcMap en getSyncStatus.

## Bestanden

| Bestand | Wijziging |
|---|---|
| `src/components/settings/SettingsAccountingTab.tsx` | `enabled: true`, nieuwe `MoneybirdSection`, render blok |
| `src/pages/CustomerCreatePage.tsx` | Auto-sync naar Moneybird |

