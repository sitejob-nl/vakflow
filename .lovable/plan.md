

## Plan: Pull-invoices daadwerkelijk importeren + ontkoppelde klanten melden

### Probleem
`pull-invoices` is nu read-only: het haalt facturen uit Exact maar slaat ze niet op in de lokale database. De gebruiker wil dat facturen daadwerkelijk worden geimporteerd, en als een klant niet gekoppeld is, moet dat duidelijk gemeld worden (niet overslaan).

### Veiligheid & RLS
De edge function gebruikt `createAdminClient()` (service role) die RLS omzeilt. Dit is correct voor server-side sync, maar het betekent dat de `company_id` **altijd expliciet** meegegeven moet worden bij inserts. De huidige code haalt `companyId` op via `authenticateRequest()` die de JWT valideert en de company_id uit het profiel haalt -- dit is veilig.

### Aanpassingen

**1. Edge function `sync-exact/index.ts` -- `pull-invoices` case (regels 352-378)**

Huidige logica: alleen lezen en een lijst teruggeven.

Nieuwe logica:
- Haal facturen op uit Exact via `salesinvoice/SalesInvoices` (met paginering)
- Haal ook `OrderedBy` op in `$select` zodat we de klant kunnen matchen
- Voor elke factuur:
  - Als `exact_id` al bestaat lokaal → skip (al geïmporteerd)
  - Zoek de lokale klant via `exact_account_id = OrderedBy`
  - Als klant NIET gevonden → voeg toe aan `unlinked_customers` lijst met de Exact Account naam (haal op via apart request of uit de factuur)
  - Als klant WEL gevonden → insert factuur met `company_id`, `customer_id`, `exact_id`, `status: "verstuurd"`, bedragen, etc.
- Return: `{ imported, already_linked, unlinked_customers: [{name, exact_account_id}], errors }`

**2. Edge function -- extra: haal Exact Account namen op voor ontkoppelde klanten**

Om de klantnaam te tonen voor ontkoppelde facturen, haal ik de unieke `OrderedBy` GUIDs op en doe een batch lookup via `crm/Accounts?$filter=ID eq guid'...'` of cache ze in-memory tijdens de loop.

**3. Frontend `src/hooks/useInvoices.ts` -- `usePullInvoicesExact` return type**

Update return type naar:
```ts
{ imported: number; already_linked: number; unlinked_customers: { name: string; exact_account_id: string }[]; errors: string[] }
```

**4. Frontend `src/pages/SettingsPage.tsx` -- pull-invoices toast**

Na pull, als er `unlinked_customers` zijn:
- Toon een waarschuwing-toast met de namen van niet-gekoppelde klanten
- Suggestie: "Synchroniseer eerst je klanten om deze facturen te importeren"

### Beveiligingsgaranties
- `company_id` wordt altijd expliciet gezet bij INSERT (niet afgeleid van de data)
- `authenticateRequest()` valideert de JWT en haalt company_id op uit het profiel via service role
- Geen factuur kan worden ingevoegd zonder geldige `company_id` + `customer_id` combinatie
- Facturen zonder gekoppelde klant worden NIET geïmporteerd maar WEL gemeld

