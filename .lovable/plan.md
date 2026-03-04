

# Plan: WhatsApp Connect per bedrijf (multi-tenant)

## Huidige situatie

De `whatsapp_config` tabel heeft al een `company_id` kolom en `whatsapp-send` + `whatsapp-webhook` zijn al multi-tenant aware. Maar `whatsapp-register` werkt nog globaal:

1. **Globale tenant check** — zoekt ANY tenant_id zonder company filter
2. **Hardcoded UUID** — upsert naar `00000000-0000-0000-0000-000000000001` i.p.v. per bedrijf
3. **Geen company_id** — slaat geen company_id op bij registratie

## Wat wordt aangepast

### 1. Edge function `whatsapp-register` herschrijven

- `authenticateRequest` retourneert al `companyId` — gebruik dit
- Check bestaande tenant_id **gefilterd op company_id**
- Upsert met `company_id` als key (niet hardcoded UUID)
- Geeft elk bedrijf zijn eigen tenant bij SiteJob Connect

### 2. Edge function `whatsapp-config` (config push van Connect)

- Na upsert op `phone_number_id`, zorg dat `company_id` behouden blijft (al correct via upsert op bestaand record)
- Geen wijzigingen nodig — de config push matcht op `phone_number_id` dat al gekoppeld is aan een company

### 3. Database: unique constraint op company_id

- Voeg `UNIQUE(company_id)` toe zodat elk bedrijf maximaal één WhatsApp config heeft
- Verwijder de hardcoded UUID-afhankelijkheid

### 4. Frontend: SettingsPage

- Stuur `company_id` niet mee (edge function haalt dit uit auth) — al correct
- Geen wijzigingen nodig

## Bestanden

| Bestand | Wijziging |
|---------|-----------|
| `supabase/functions/whatsapp-register/index.ts` | Company-scoped tenant registratie |
| `supabase/migrations/...` | UNIQUE constraint op `whatsapp_config.company_id` |

## Technisch detail

```typescript
// whatsapp-register: company-scoped
const { companyId } = await authenticateRequest(req);

// Check bestaande tenant voor DIT bedrijf
const { data: existingConfig } = await supabaseAdmin
  .from("whatsapp_config")
  .select("tenant_id")
  .eq("company_id", companyId)
  .maybeSingle();

if (existingConfig?.tenant_id) {
  return jsonRes({ tenant_id: existingConfig.tenant_id, existing: true });
}

// Registreer nieuwe tenant bij Connect
// ...

// Upsert met company_id als scope (gen_random_uuid voor id)
await supabaseAdmin.from("whatsapp_config").upsert({
  company_id: companyId,
  phone_number_id: "pending",
  access_token: "pending",
  tenant_id,
  webhook_secret,
}, { onConflict: "company_id" });
```

