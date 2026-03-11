

# Rompslomp Koppeling — Volledige Uitbreiding

## Wat er al is
- `sync-rompslomp/index.ts`: Achtergrond-sync (contacts, invoices, quotes) met per-tenant encrypted tokens
- `rompslomp-config/index.ts` + `rompslomp-webhook/index.ts`: Webhook handlers
- `SettingsAccountingTab.tsx`: Basis Rompslomp settings (API token, company ID, tenant ID)
- `useInvoices.ts`: Sync hooks (sync-contacts, sync-invoices, pull-contacts, pull-invoices)

## Wat erbij komt

### 1. Nieuwe edge function: `rompslomp-api`
Generieke API proxy gebaseerd op de referentie, maar aangepast voor multi-tenant:
- Gebruikt `authenticateRequest()` uit `_shared/supabase.ts` i.p.v. `is_staff` RPC
- Haalt `rompslomp_company_id` + encrypted `rompslomp_api_token` op uit `companies` tabel per tenant
- Decrypteert token met `decrypt()` uit `_shared/crypto.ts`
- Ondersteunde acties: `list_contacts`, `search_contact`, `create_contact`, `update_contact`, `list_invoices`, `get_invoice`, `create_invoice`, `update_invoice`, `delete_invoice`, `get_invoice_pdf`, `list_quotations`, `get_quotation`, `create_quotation`, `update_quotation`, `delete_quotation`, `get_quotation_pdf`, `list_products`, `create_product`, `update_product`, `delete_product`
- Rate limiting via `checkRateLimit()`
- PDF endpoints retourneren base64-encoded data

### 2. Nieuwe hook: `src/hooks/useRompslomp.ts`
Gebaseerd op de referentie, aangepast voor Vakflow:
- `callRompslompApi()` wrapper via `supabase.functions.invoke('rompslomp-api')`
- Settings: leest `rompslomp_company_id` uit `companies_safe` view (geen aparte `rompslomp_settings` tabel nodig)
- Query hooks: contacts, invoices, quotations, products
- Mutation hooks: CRUD voor elk resource type
- PDF download helpers (base64 → blob → download)
- Contact import: `useImportRompslompContact()` — maakt Vakflow-klant aan vanuit Rompslomp contact
- Contact sync: `useSyncCustomerToRompslomp()` — pusht Vakflow-klant naar Rompslomp
- Quotation→Invoice conversie

### 3. UI componenten (4 nieuwe bestanden)

**`src/components/RompslompContacts.tsx`**
- Contacten lijst met zoekfunctie
- Import-knop per contact (met check of al geïmporteerd via `rompslomp_contact_id`)
- Status-indicatie (al geïmporteerd / niet geïmporteerd)

**`src/components/RompslompInvoices.tsx`**
- Facturen lijst met filters (alle, verstuurd, concept, onbetaald, betaald)
- Datum-range filter (3 maanden, 6 maanden, jaar, alles)
- PDF download per factuur
- Statistieken (totaal, betaald, onbetaald, openstaand bedrag)

**`src/components/RompslompQuotations.tsx`**
- Offertes lijst met status-badges
- PDF download
- Quotation→Invoice conversie dialoog

**`src/components/RompslompProducts.tsx`**
- Producten lijst
- Nieuw product aanmaken dialoog
- Product verwijderen

### 4. Integratie in SettingsAccountingTab
Wanneer provider "rompslomp" is, toon een "Rompslomp beheer" sectie met tabs/links naar de nieuwe componenten, naast de bestaande configuratie-velden.

### 5. Config
- `supabase/config.toml`: Toevoegen `[functions.rompslomp-api]` entry (met JWT verificatie)

## Bestanden

| Bestand | Actie |
|---------|-------|
| `supabase/functions/rompslomp-api/index.ts` | **Nieuw** — generieke API proxy |
| `supabase/config.toml` | Toevoegen `rompslomp-api` entry |
| `src/hooks/useRompslomp.ts` | **Nieuw** — React hooks |
| `src/components/RompslompContacts.tsx` | **Nieuw** |
| `src/components/RompslompInvoices.tsx` | **Nieuw** |
| `src/components/RompslompQuotations.tsx` | **Nieuw** |
| `src/components/RompslompProducts.tsx` | **Nieuw** |
| `src/components/settings/SettingsAccountingTab.tsx` | Uitbreiden met Rompslomp beheer-links |

Geen database-wijzigingen nodig — alle benodigde kolommen (`rompslomp_company_id`, `rompslomp_api_token`, `rompslomp_contact_id`) bestaan al.

