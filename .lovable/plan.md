

# Leads API (REST Edge Function + API Keys)

## Overzicht

Een publieke REST API waarmee externe systemen (websites, formulieren, Zapier, etc.) leads kunnen aanmaken en ophalen via een API key per bedrijf.

## Technisch plan

### 1. Database: `api_keys` tabel

```sql
CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  key_hash text NOT NULL,          -- SHA-256 hash van de key
  key_prefix text NOT NULL,        -- eerste 8 chars voor herkenning (vk_abc12345...)
  name text NOT NULL DEFAULT 'API Key',
  created_at timestamptz DEFAULT now(),
  last_used_at timestamptz,
  is_active boolean DEFAULT true
);
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company admins manage own keys" ON api_keys
  FOR ALL TO authenticated
  USING (company_id = (SELECT get_my_company_id()));
```

De plaintext key wordt alleen bij aanmaak getoond, daarna alleen de hash opgeslagen.

### 2. Edge Function: `leads-api/index.ts`

Endpoint: `POST/GET /leads-api`

**Authenticatie via `X-API-Key` header:**
- Hash de ontvangen key met SHA-256
- Lookup in `api_keys` tabel → krijg `company_id`
- Alle queries scoped op dat `company_id`

**Routes (via query param `?action=...` of HTTP method):**

| Method | Beschrijving |
|--------|-------------|
| `GET` | Lijst leads (optioneel `?status=...`, `?limit=`, `?offset=`) |
| `GET ?id=xxx` | Enkele lead ophalen |
| `POST` | Lead aanmaken (`name` verplicht, rest optioneel) |
| `PATCH ?id=xxx` | Lead updaten (status, velden) |
| `DELETE ?id=xxx` | Lead verwijderen |

**Response format:** Standaard JSON met `{ data, error, count }`.

**Rate limiting:** Gebruik bestaande `checkRateLimit` helper (max 60 req/min).

### 3. UI: API Keys beheer in Instellingen

In `SettingsIntegrationsTab.tsx` (of nieuwe sectie):
- "API Keys" kaart met lijst bestaande keys (prefix + naam + laatst gebruikt)
- "Nieuwe key aanmaken" knop → genereert `crypto.randomUUID()` key, toont eenmalig
- Verwijder/deactiveer knoppen
- Documentatie-blok met voorbeeld curl-commando's

### 4. Config

```toml
[functions.leads-api]
verify_jwt = false
```

### Samenvatting wijzigingen

| Component | Wijziging |
|---|---|
| Migration SQL | `api_keys` tabel + RLS |
| `supabase/functions/leads-api/index.ts` | Nieuwe edge function |
| `supabase/config.toml` | `verify_jwt = false` |
| `src/components/settings/SettingsIntegrationsTab.tsx` | API Keys beheer UI |
| `src/integrations/supabase/types.ts` | Auto-update |

