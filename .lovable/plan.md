

# Apply uploaded edge function improvements

The uploaded files contain improvements to 4 edge functions. Here's a summary of the changes from the patch file:

## 1. `exact-webhook/index.ts` — Add invoice payment status processing

Currently just logs and acknowledges webhooks. The update adds:
- `getExactToken` helper to fetch access tokens from SiteJob Connect
- `logEdgeFunctionError` import for error logging
- Query `tenant_id` and `division` from `exact_config`
- When a `SalesInvoices` webhook arrives, fetch the invoice from Exact to check if `Status === 50` (paid), and if so update the local invoice to `betaald`

## 2. `moneybird-webhook/index.ts` — Add URL-based webhook secret verification

Currently validates only by `administration_id` match. The update adds:
- Parse `?secret=` from the webhook URL
- Reject requests without a secret parameter (401)
- Verify the secret matches `company.moneybird_webhook_secret` (403 if mismatch)
- Select `moneybird_webhook_secret` in the company query

## 3. `sync-exact/index.ts` — Invoice sync improvements

Three fixes:
- **Fiscal year filter**: Only sync invoices from current year (`gte("issued_at", fiscalYearStart)`) to avoid closed-period errors
- **VAT-exclusive pricing**: Convert `unit_price` (incl. BTW) to `NetPrice` (excl. BTW) using `vat_percentage` before pushing to Exact
- **Error logging**: Log individual invoice sync failures via `logEdgeFunctionError`
- Add `logEdgeFunctionError` import

Both the batch `sync-invoices` and single `push-invoice` cases get the VAT fix.

## 4. `sync-moneybird/index.ts` — Secure webhook registration

Currently registers webhooks without a secret. The update:
- Generates a random 32-byte hex secret
- Appends `?secret={secret}` to the webhook callback URL
- Stores the secret in `companies.moneybird_webhook_secret` after successful registration

## Files to modify

| File | Change |
|---|---|
| `supabase/functions/exact-webhook/index.ts` | Replace with uploaded `index_36.ts` |
| `supabase/functions/moneybird-webhook/index.ts` | Replace with uploaded `index_37.ts` |
| `supabase/functions/sync-exact/index.ts` | Apply VAT fix, fiscal year filter, error logging |
| `supabase/functions/sync-moneybird/index.ts` | Secure webhook registration with secret |

All 4 functions will be redeployed. No database changes needed (`moneybird_webhook_secret` column already exists).

