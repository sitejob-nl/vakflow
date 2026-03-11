

# Fix: Exact Online connection not visible — missing `exact_config` row

## Root cause

Two tables store Exact Online data:
- **`exact_online_connections`** — created by `exact-register`, stores OAuth connection data (tenant_id, webhook_secret, division). Has an active row for your company.
- **`exact_config`** — read by the settings UI and `sync-exact`, stores sync settings (GL account, journal, VAT codes, status). **Has no row for your company.**

The `exact-register` function inserts into `exact_online_connections` but never creates a corresponding `exact_config` row. The `exact-config` webhook (called by SiteJob Connect after OAuth) also only updates `exact_online_connections`. So the settings UI shows "not connected" because it reads from `exact_config`.

## Fix

### 1. `exact-register/index.ts` — also create `exact_config` row

After inserting into `exact_online_connections`, also upsert into `exact_config` with status `"pending"`, copying `tenant_id` and `webhook_secret`. This ensures the settings UI immediately shows the pending state.

### 2. `exact-config/index.ts` (webhook) — also update `exact_config` row

When the webhook receives the `connected` callback (division + company_name), also update `exact_config` to set `status = "connected"`, `division`, and `company_name_exact`. When disconnecting, set `status = null`.

### 3. Immediate fix — insert the missing row now

Run a migration to create the `exact_config` row from the existing `exact_online_connections` data, so your current connection becomes visible immediately without re-registering.

## Files to modify

| File | Change |
|---|---|
| `supabase/functions/exact-register/index.ts` | After `exact_online_connections` insert, also upsert `exact_config` with status "pending" |
| `supabase/functions/exact-config/index.ts` | On connect callback, also update `exact_config` status/division/company_name; on disconnect, reset status |
| Database migration | Insert `exact_config` row from existing `exact_online_connections` data |

## Migration SQL

```sql
INSERT INTO exact_config (company_id, tenant_id, webhook_secret, division, company_name_exact, status)
SELECT company_id, tenant_id, webhook_secret, exact_division::integer, company_name, 'connected'
FROM exact_online_connections
WHERE is_active = true
  AND company_id NOT IN (SELECT company_id FROM exact_config)
ON CONFLICT DO NOTHING;
```

