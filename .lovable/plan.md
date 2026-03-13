

# Hexon Frontend Updates — Implementation Plan

The uploaded file contains 3 prompts for updating the Hexon integration frontend. The backend (edge functions, database columns) is already deployed. This plan covers all three prompts.

---

## Prompt 1: SettingsHexonTab Overhaul

**Current state**: The tab has a simple API Key + URL + publication form with hardcoded portal checkboxes.

**Changes to `src/components/settings/SettingsHexonTab.tsx`**:

1. **Replace the `HexonConfig` interface** with new fields: `api_url`, `endpoint`, `publication`, `auth_method` ("basic"|"bearer"), `username`, `password`, `bearer_token`, `default_currency`, `incl_vat`, `vat_pct`, `event_subscription_id`, plus existing `default_site_codes`, `auto_publish`, `photo_overlay_code`.

2. **Connection section**: Replace single API Key field with:
   - API URL (default `https://api.hexon.nl`), with sandbox hint
   - Endpoint text input (placeholder "spi")
   - Publication text input (placeholder "demo")

3. **Authentication section**: Radio group for `auth_method`:
   - "basic" → username + password (with eye toggle)
   - "bearer" → bearer_token (with eye toggle)
   - Remove old `api_key` field

4. **Pricing section**: Currency select (EUR/USD/GBP), incl_vat toggle, vat_pct number input (conditional)

5. **Portals section**: Replace hardcoded `PORTALS` list with:
   - "Beschikbare portalen ophalen" button → calls `hexon-sync` with `action: "fetch_sites"`
   - Renders results as checkboxes; pre-selects existing `default_site_codes`
   - State: `availableSites`, `fetchingSites`

6. **Webhook section**: 
   - Show webhook URL with `?company_id={companyId}` appended
   - "Webhook registreren" button → calls `hexon-sync` with `action: "setup_webhook"`
   - Shows green badge if `event_subscription_id` exists
   - "Opnieuw registreren" option if already registered

7. **Test connection**: Enhanced with per-step results (auth check, sites check) with green/red indicators and specific error messages (401, 404, network)

8. **Save handler**: Update payload to include all new fields, remove `api_key`

---

## Prompt 2: Hexon Listings Display Updates

**Changes to `src/hooks/useTradeVehicles.ts`**:
- Update `HexonListing` interface: add `ad_key`, `portal_name`, `notifications` fields

**Changes to `src/pages/TradeVehiclesPage.tsx`**:
- Update the table view to add a "Portaalstatus" column showing per-listing badges with colored dots, portal names, warning/error icons, and clickable deeplinks

**Changes to `src/components/TradeVehicleDetailSheet.tsx`**:
- Enhance the existing Hexon tab:
  - Show `portal_name` alongside `site_code`
  - Add notifications display (orange warnings)
  - Per-listing actions: "Status vernieuwen" (`fetch_status`), "Offline halen" (`unpublish`)
  - Global actions: "Publiceren naar alle portalen", "Alle statussen vernieuwen", "Voertuigdata bijwerken"

**Changes to dashboard** (automotive): Add Hexon KPI cards (online count, denied count, pending count) — only if `enabledFeatures` includes `hexon`.

---

## Prompt 3: Hexon Onboarding Wizard

**New component or inline in `SettingsHexonTab`**: A 4-step wizard shown when `hexon_config.status !== 'active'` (or no config exists):

1. **Step 1 "Welkom"**: Explanation + "Heb je al een Hexon account?" toggle
2. **Step 2 "Gegevens"**: API URL, endpoint, publication, auth method + credentials, test connection button
3. **Step 3 "Portalen"**: Auto-fetch sites via `fetch_sites`, show as checkboxes
4. **Step 4 "Webhook"**: Auto-register webhook, show success/failure

After completion: save config with `status: 'active'`, show normal settings view.

The wizard renders as a full-width card replacing the settings form when no active config exists.

---

## Implementation Order

1. **SettingsHexonTab** — biggest change, restructure the entire form
2. **Onboarding wizard** — conditional rendering within the same tab
3. **TradeVehicles listings** — update interface, table column, detail sheet
4. **Dashboard KPIs** — small addition

All changes are frontend-only; no edge function or database modifications needed.

