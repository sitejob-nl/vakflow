

## Analysis: Gaps between current `sync-exact` and the Exact Online API Reference

The current implementation covers the basics but has several issues when compared to the API reference:

### Issues Found

**1. sync-contacts: Missing required fields & no Account ID tracking**
- Pushes `Name`, `Email`, `Phone`, `City`, `Postcode`, `AddressLine1` — this is correct per the API
- But does NOT set `Status: "C"` (Customer) — Exact defaults to no status
- Does NOT store the returned Exact Account ID back on the customer record (no `exact_account_id` column exists)
- Uses `eboekhouden_relation_id IS NULL` as filter — wrong field, should use a dedicated `exact_account_id`
- Does NOT include `Country`, `VATNumber`, `ChamberOfCommerce` which are available on local customers (`btw_number` on companies)

**2. sync-invoices: Missing verplichte velden**
- Missing `Journal` (verplicht!) — e.g. `"70"` for sales journal
- Missing `OrderedBy` (verplicht!) — the Exact Account GUID of the customer
- Invoice lines use `UnitPrice` + `VATPercentage` but the API expects `Item` or `GLAccount` as required per line — current code sends neither
- No linkage between local customer and Exact Account ID, so `OrderedBy` can't be set

**3. pull-invoices: Only counts, never actually imports**
- The code increments `imported++` but never inserts into the `invoices` table (comment says "Skip — we'd need customer mapping")

**4. pull-contacts: No pagination**
- Uses `$top=500` but Exact returns max 60 per page by default. The `$top` param works but for >500 accounts there's no `__next` pagination handling

**5. No `exact_account_id` column on customers table**
- Critical for two-way sync and invoice sync (need the Exact GUID to set `OrderedBy`)

**6. Error handling: No 429 rate limit handling**
- API reference specifies rate limits; current code doesn't retry on 429

### Plan

| Change | File |
|--------|------|
| Add `exact_account_id` column to `customers` table | Migration |
| Fix `sync-contacts`: add `Status: "C"`, `Country: "NL"`, store returned Account ID | `sync-exact/index.ts` |
| Fix `sync-invoices`: add `Journal`, `OrderedBy` (from exact_account_id), use `Description`+`Quantity`+`NetPrice` per line (no Item/GLAccount required for direct invoices) | `sync-exact/index.ts` |
| Fix `pull-contacts`: add `__next` pagination support | `sync-exact/index.ts` |
| Fix `pull-invoices`: actually import or clearly return read-only data | `sync-exact/index.ts` |
| Add pagination helper using `__next` URL pattern from API docs | `sync-exact/index.ts` |
| Store Exact invoice ID back on local invoice (`exact_id` column) to prevent duplicates on re-sync | Migration + code |

### Implementation Details

**Migration**: Add two columns
```sql
ALTER TABLE customers ADD COLUMN exact_account_id text;
ALTER TABLE invoices ADD COLUMN exact_id text;
```

**sync-exact/index.ts** key changes:

1. Replace `exactGet` with paginated version using `__next`
2. `sync-contacts`:
   - Filter on `exact_account_id IS NULL` instead of `eboekhouden_relation_id`
   - Add `Status: "C"`, `Country: "NL"` to POST body
   - Parse response to get Account ID, update customer with `exact_account_id`
3. `sync-invoices`:
   - Skip invoices where customer has no `exact_account_id`
   - Add `Journal: "70"` and `OrderedBy: customer.exact_account_id`
   - Use `Description`, `Quantity`, `NetPrice` per line (direct invoice type 8023 doesn't require Item/GLAccount)
   - Store returned invoice ID as `exact_id`
   - Filter on `exact_id IS NULL` to avoid duplicates
4. `pull-invoices`: return data as read-only list (no insert, since customer mapping is ambiguous)

