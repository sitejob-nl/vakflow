

# Fix Exact Online invoice sync: Item is required per API spec

## Problem
According to the Exact Online API documentation you shared, **`Item` is mandatory** in each `SalesInvoiceLine`. The current code only includes `Item` when `item.exact_item_id` exists on the invoice line data. When items don't have an Exact item reference, the API returns "Verplicht: Artikel".

## Solution
Add a **default sales item** (`default_item_id`) configuration to `exact_config`, similar to how `gl_revenue_id` and `journal_code` work. This item acts as a fallback for invoice lines without a specific `exact_item_id`.

### Changes

**1. Database migration** — Add `default_item_id` column to `exact_config`
```sql
ALTER TABLE exact_config ADD COLUMN default_item_id text;
```

**2. Settings UI** (`src/components/settings/SettingsAccountingTab.tsx`)
- Add a third dropdown: **Standaard artikel** (Default sales item)
- Fetches from `logistics/Items?$filter=IsSalesItem eq true&$select=ID,Code,Description`
- Saves to `exact_config.default_item_id`

**3. sync-exact invoice logic** (`supabase/functions/sync-exact/index.ts`)
- For both `sync-invoices` and `create-invoice` cases:
  - Each invoice line sets `Item` to `item.exact_item_id ?? config.default_item_id`
  - If neither exists, return a clear error: "Stel eerst een standaard artikel in"
- Add a pre-check similar to the `gl_revenue_id` check

### Files to modify

| File | Change |
|---|---|
| Database migration | Add `default_item_id` column to `exact_config` |
| `src/components/settings/SettingsAccountingTab.tsx` | Add "Standaard artikel" dropdown fetching from `logistics/Items` |
| `supabase/functions/sync-exact/index.ts` | Use `default_item_id` as fallback for `Item` in invoice lines; add validation |

