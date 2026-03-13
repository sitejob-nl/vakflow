

## Bugfixes Boekhouding — 2 issues

### Bug 1: InvoicesPage bulk sync — verkeerde action voor e-Boekhouden
**Bestand:** `src/pages/InvoicesPage.tsx` regel 200-204

De `funcMap` stuurt nu altijd `action: "sync-invoices"` maar e-Boekhouden verwacht `"sync-all-invoices"`.

**Fix:** `funcMap` wijzigen van `Record<string, string>` naar `Record<string, { func, action }>` zodat elke provider zijn eigen action krijgt.

### Bug 2: CustomerCreatePage — Exact Online auto-sync ontbreekt
**Bestand:** `src/pages/CustomerCreatePage.tsx` regel 95-115

Na aanmaken van een klant wordt auto-sync gedaan naar WeFact, Moneybird, e-Boekhouden en Rompslomp, maar Exact Online ontbreekt.

**Fix:** Vóór de WeFact check (regel 96) een `if (accountingProvider === "exact")` blok toevoegen dat `sync-exact` aanroept met `action: "sync-customer"`.

