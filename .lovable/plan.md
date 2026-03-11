

# Replace InvoicesPage.tsx with provider-agnostic version

## What changes

Full file replacement of `src/pages/InvoicesPage.tsx` (714 lines → 675 lines). The uploaded file is taken verbatim — no merging.

## Key differences from current file

1. **Removed imports**: `useInvoices`, `useSyncInvoiceEboekhouden`, `usePullInvoiceStatusEboekhouden`, `useSyncInvoicesRompslomp`, `usePullInvoiceStatusRompslomp`, `useSyncInvoicesMoneybird`, `usePullInvoiceStatusMoneybird` — all gone
2. **Removed hooks**: `syncEb`, `pullStatusEb`, `syncRompslomp`, `pullStatusRompslomp`, `syncMoneybird`, `pullStatusMoneybird` — 6 hook instantiations removed
3. **Removed handlers**: `handleSyncRompslomp`, `handleSyncMoneybird`, `handleSyncEb`, `handleSyncExact` — replaced by generic `funcMap` pattern
4. **Generic auto-sync on "verzonden"** (lines 97-113): One `funcMap` with all 5 providers
5. **Generic pull-status on "betaald"** (lines 139-153): One `pullFuncMap` with correct action names
6. **Generic sync button + indicator** (lines 452-512): IIFE pattern with `providerIdMap` and `providerLabelMap`

## Three verification points (per your instructions)

1. **IIFE in JSX** (lines 453-512): The `{accountingProvider && (() => { ... })()}` pattern with `providerIdMap` using `(selected as any).exact_id` — will be preserved exactly as-is
2. **`useQueryClient` import** (line 12): Present in the uploaded file — `import { useQueryClient } from "@tanstack/react-query"`
3. **Edge functions**: No edge function files are modified — only the frontend file changes

## File

| File | Action |
|---|---|
| `src/pages/InvoicesPage.tsx` | Full replacement with uploaded 675-line version |

