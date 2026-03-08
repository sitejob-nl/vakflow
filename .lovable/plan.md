

## Fix: Exact Online Connection URL

### Problem
The frontend opens the wrong URL when starting the Exact Online connection:
```
https://xeshjkznwdrxjjhbpisn.supabase.co/functions/v1/exact-connect?tenant_id=...
```
This function doesn't exist on the Connect project. The correct URL per the SiteJob Connect documentation is:
```
https://connect.sitejob.nl/exact-setup?tenant_id=...
```

### Changes

**File: `src/components/settings/SettingsAccountingTab.tsx`**

1. **Fix the connect URL** (line 41): Change from the non-existent edge function URL to `https://connect.sitejob.nl/exact-setup?tenant_id=${tenantId}`

2. **Open as popup instead of new tab** (line 42): Use `window.open` with popup dimensions (`width=600,height=700`) so the postMessage event works

3. **Add postMessage listener**: After opening the popup, listen for the `exact-connected` message event. On success, auto-refresh the Exact config status from the database (reuse existing `handleRefreshStatus` logic) instead of requiring the user to manually click "Status vernieuwen"

### Summary
- 1 file changed: `SettingsAccountingTab.tsx`
- Fix URL from edge function path to `connect.sitejob.nl/exact-setup`
- Popup window + postMessage listener for seamless UX

