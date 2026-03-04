

## Plan: Fix WhatsApp tenant_id collision

### Root Cause

Database query reveals both companies share the **same** `tenant_id` (`635800af-1a2f-4d4a-8039-4af59c737068`):

```text
company 2a5c7a99 (kas@sitejob.nl)       → real credentials (working)
company 516ea242 (kas@worldofdeals.nl)   → phone_number_id="pending", access_token="pending" (broken)
```

This happened because the old registration used identical webhook URLs. The register function finds the existing `tenant_id` for company 516ea242 and returns early without re-registering, so the user is stuck.

### Fix: Two changes

**1. Edge Function `whatsapp-register/index.ts` -- don't return early for stale/pending configs**

When the existing config still has `phone_number_id = "pending"`, the tenant registration clearly never completed. Instead of returning early, delete the stale row and proceed with a fresh registration using the now-unique webhook URL.

```typescript
if (existingConfig?.tenant_id) {
  // If credentials are still pending, the previous registration never completed
  // → delete stale row and re-register with unique webhook_url
  if (existingConfig.phone_number_id === 'pending') {
    await supabaseAdmin.from("whatsapp_config").delete().eq("company_id", companyId);
    // fall through to re-register
  } else {
    return jsonRes({ tenant_id: existingConfig.tenant_id, existing: true });
  }
}
```

This requires also selecting `phone_number_id` in the initial query.

**2. Data fix -- clean up the duplicate tenant_id (migration)**

Delete the stale pending row for company 516ea242 so the next registration attempt starts clean:

```sql
DELETE FROM whatsapp_config 
WHERE company_id = '516ea242-9694-46f7-9efa-d6d87ae1f849' 
  AND phone_number_id = 'pending';
```

| Bestand | Wijziging |
|---------|-----------|
| `supabase/functions/whatsapp-register/index.ts` | Don't return early for pending configs; re-register instead |
| Migration | Delete stale pending row for company 516ea242 |

