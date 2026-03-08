

# Edge Function Hardening Plan

Based on Claude's analysis, here are the concrete fixes across 4 edge functions.

---

## 1. ai-intake: Add rate limiting, usage logging, error logging, conditional work_order_type

**File:** `supabase/functions/ai-intake/index.ts`

- Import `logUsage`, `logEdgeFunctionError`, `checkRateLimit` from shared helpers
- Import `createAdminClient` (already present)
- After `authenticateRequest`, call `checkRateLimit(admin, companyId, "ai_intake", 10, 60)` — max 10 per minute
- After successful AI response, call `logUsage(admin, companyId, "ai_intake", { complaint_length: complaint.length })`
- In catch block, call `logEdgeFunctionError(admin, "ai-intake", err.message, ...)`
- Make `work_order_type` property conditional: only include it in the function schema when `isAutomotive === true`

## 2. rdw-lookup: Cache defect descriptions, use parameter syntax, add auth check

**File:** `supabase/functions/rdw-lookup/index.ts`

**Database migration:** Create `rdw_defect_descriptions` table (id text PK, description text, updated_at timestamptz). No RLS needed (internal use only via service role).

**Function changes:**
- Add JWT/anon-key validation at the top (import `createUserClient` from shared, verify bearer token)
- Replace the `hx2c-gt7k` fetch with a Supabase lookup on `rdw_defect_descriptions` table; if empty or stale (>7 days), fetch from RDW API and upsert into the table
- Replace the `$$query=SELECT * WHERE kenteken='${normalized}'` with the resource API parameter syntax: `?kenteken=${normalized}` (same as the other parallel fetches)
- Add `logEdgeFunctionError` in catch block

## 3. apk-reminder-scan: Fix reminder window logic

**File:** `supabase/functions/apk-reminder-scan/index.ts`

- Current bug: thresholds `[30, 14, 7]` — if `daysUntilExpiry = 20`, it passes the `30` threshold check (`20 <= 30 && 20 >= 0`) and sends the 30d reminder even though 20 is past the 30-day window
- Fix: add upper-bound check. For threshold at index `i`, only send if `daysUntilExpiry <= threshold && daysUntilExpiry > (nextThreshold || 0)` where `nextThreshold` is `days_before[i+1]` or `0` for the last one
- Specifically, sort thresholds descending, then for each threshold check: `daysUntilExpiry <= threshold && daysUntilExpiry > (days_before[idx + 1] || 0)`

## 4. whatsapp-automation-trigger: Add vehicle context for automotive templates

**File:** `supabase/functions/whatsapp-automation-trigger/index.ts`

- After fetching the customer, check if `customer.company_id` belongs to an automotive company
- If so, fetch the customer's vehicles: `SELECT license_plate, brand, model, apk_expiry_date FROM vehicles WHERE customer_id = ? AND status = 'actief' LIMIT 1`
- Merge vehicle fields into `fullContext` so templates can use `{{kenteken}}`, `{{merk}}`, `{{model}}`, `{{apk_datum}}`, `{{dagen}}`

---

## Summary of changes

| Function | Files | What |
|---|---|---|
| ai-intake | 1 edge function | Rate limit, usage/error logging, conditional schema |
| rdw-lookup | 1 migration + 1 edge function | Defect cache table, auth check, parameterized query |
| apk-reminder-scan | 1 edge function | Fix window bounds logic |
| whatsapp-automation-trigger | 1 edge function | Vehicle context enrichment |

