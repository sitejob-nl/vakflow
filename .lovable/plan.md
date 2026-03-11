

# Fix Exact Online sync: 5 critical issues found in API alignment

Based on the comprehensive API reference you uploaded, the current `sync-exact` implementation has several significant bugs that will cause incorrect data or silent failures.

---

## Issues and fixes

### 1. `NetPrice` is used incorrectly (causes wrong amounts)

The documentation states:
- **`UnitPrice`** = price per unit, **excluding VAT**
- **`NetPrice`** = line total **including VAT** (`AmountFC + VATAmountFC`)

The current code sends `NetPrice` as the price excluding VAT. This is backwards — Exact interprets `NetPrice` as VAT-inclusive, leading to double-counting or wrong totals.

**Fix:** Replace `NetPrice` with `UnitPrice` in all invoice line payloads (both `sync-invoices` and `exact-sync-invoices/index.ts`).

### 2. `pull-status` logic is fundamentally wrong (invoices never marked paid)

The documentation explicitly states: **"There is no 'Paid' status on the SalesInvoice object. Status 50 means 'Processed' (finalized), not paid."**

The current code fetches invoices with `Status ne 50` and then checks `if (exactStatus === 50)` — which can never be true. Even if the filter were fixed, Status 50 still doesn't mean "paid".

**Fix:** Replace the entire `pull-status` implementation with a call to `read/financial/ReceivablesList`. This endpoint returns all **unpaid** invoices. If a synced invoice does NOT appear in ReceivablesList, it has been fully paid.

### 3. VATCode uses wrong format (numeric instead of string codes)

The documentation specifies string codes: `"VH"` (21% BTW Hoog), `"VL"` (9% BTW Laag), `"VN"` (0%). The `exact-sync-invoices/index.ts` sends numeric codes `"1"`, `"2"`, `"4"` which may cause validation errors or incorrect VAT calculation.

**Fix:** Update `mapVatCode()` in `exact-sync-invoices/index.ts` to return `"VH"`, `"VL"`, `"VN"`.

### 4. GLAccount is redundant when Item is provided

The docs state: "Each line requires either an `Item` GUID (from which `GLAccount` auto-populates from the item's revenue account) or an explicit `GLAccount` GUID." Sending both may cause conflicts.

**Fix:** Only send `GLAccount` when no `Item` is present. When `Item` is set, omit `GLAccount` to let Exact auto-populate it from the item's configuration.

### 5. `UnitPrice` used in `exact-sync-invoices/index.ts` also wrong

The older `exact-sync-invoices` function uses `NetPrice` identically to `sync-exact`. Same fix applies.

---

## Files to modify

| File | Changes |
|---|---|
| `supabase/functions/sync-exact/index.ts` | Replace `NetPrice` → `UnitPrice`; rewrite `pull-status` to use `ReceivablesList`; only send `GLAccount` when no `Item` |
| `supabase/functions/exact-sync-invoices/index.ts` | Replace `NetPrice` → `UnitPrice`; fix `mapVatCode` to return VH/VL/VN; only send `GLAccount` when no `Item` |

---

## Technical detail: new `pull-status` logic

```text
1. Fetch all local invoices with exact_id and status != "betaald"
2. GET /read/financial/ReceivablesList  →  returns unpaid invoices
3. Build set of InvoiceNumbers that are still unpaid
4. For each local invoice: if its invoice_number is NOT in the unpaid set → mark as "betaald"
```

This is the recommended approach per Exact Online's own documentation and avoids the impossible Status-50-equals-paid assumption.

