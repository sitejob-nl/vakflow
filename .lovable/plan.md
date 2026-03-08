

# SettingsPage — 8 stub tabs volledig uitwerken

## Overzicht

Er zijn 8 settings-tabs die na de SettingsPage-opsplitsing als stubs zijn achtergebleven (alleen placeholder tekst). De volledige logica moet worden hersteld/gebouwd.

## Per tab

### 1. SettingsCompanyTab (Bedrijfsgegevens)
Formulier voor: bedrijfsnaam, adres, postcode, stad, telefoon, KvK, BTW, IBAN, logo-upload, branche/subcategorie display. Slaat op naar `companies` tabel via `supabase.from("companies_safe")` read + `supabase.from("companies").update()`.

### 2. SettingsPreferencesTab (App-voorkeuren)
- PWA-naam en PWA-icoon instellen (`pwa_name`, `pwa_icon_url` op companies)
- Brand color picker (`brand_color`)
- Enabled features checklist (`enabled_features` array)

### 3. SettingsAccountingTab (Boekhouding)
- Provider selector: e-Boekhouden, Rompslomp, Moneybird, Exact Online, WeFact, Snelstart
- Per provider: credential-velden + connect/disconnect UI
- Gebruikt bestaande hooks: `useSnelstartConnection`, en companies-kolommen voor overige providers
- e-Boekhouden: api_token, ledger_id, template_id, debtor_ledger_id
- Moneybird: api_token, administration_id  
- Rompslomp: api_token, company_name, company_id, tenant_id
- WeFact: api_key
- Exact Online: via `exact_config` tabel + edge function
- Snelstart: via `snelstart_connections` + edge function

### 4. SettingsEmailTab (E-mail)
- SMTP-instellingen: host, port, email, password (`smtp_host`, `smtp_port`, `smtp_email`, `smtp_password`)
- IMAP-instellingen: host, port (`imap_host`, `imap_port`)
- Email provider toggle (SMTP vs Outlook)
- Outlook koppeling (bedrijfsniveau): client_id, tenant_id, connect flow

### 5. SettingsEmailTemplatesTab (E-mail Templates)
- CRUD lijst van `email_templates`
- Gebruikt `useEmailTemplates`, `useCreateEmailTemplate`, `useUpdateEmailTemplate`, `useDeleteEmailTemplate`
- Opent `EmailTemplateEditor` component (blok-gebaseerde editor, 461 regels, al bestaat)

### 6. SettingsWhatsAppTab (WhatsApp)
- Verbindingsstatus tonen (`useWhatsAppStatus`)
- API-key/telefoon configureren via `whatsapp-config` edge function
- Business profiel bewerken (`useWhatsAppProfile`, `useUpdateWhatsAppProfile`)
- Template lijst (`useWhatsAppTemplates`)

### 7. SettingsAutomationsTab (Automatiseringen)
- WhatsApp automations CRUD (`useWhatsAppAutomations`)
- Auto-message settings per type (`useAutoMessageSettings`, `useUpsertAutoMessageSetting`)
- Trigger type + template + variabelen mapping
- Email automation settings koppelen aan `auto_message_settings`

### 8. SettingsIntegrationsTab (Koppelingen)
- Overzicht van alle externe koppelingen met status indicators
- Snelstart, Exact, Moneybird, Rompslomp, WeFact, Outlook, Meta — elk met connected/disconnected badge
- Quick-links naar de specifieke tabs (Boekhouding, E-mail, Meta, WhatsApp)

## Aanpak

Elke tab wordt een zelfstandig component met eigen state, hooks en save-logica. Pattern volgt de bestaande `SettingsProfileTab` en `SettingsServicesTab`: card container, shared input/label classes, toast feedback, Loader2 voor loading states.

## Bestanden

| Bestand | Actie |
|---|---|
| `src/components/settings/SettingsCompanyTab.tsx` | Volledig herschrijven |
| `src/components/settings/SettingsPreferencesTab.tsx` | Volledig herschrijven |
| `src/components/settings/SettingsAccountingTab.tsx` | Volledig herschrijven |
| `src/components/settings/SettingsEmailTab.tsx` | Volledig herschrijven |
| `src/components/settings/SettingsEmailTemplatesTab.tsx` | Volledig herschrijven |
| `src/components/settings/SettingsWhatsAppTab.tsx` | Volledig herschrijven |
| `src/components/settings/SettingsAutomationsTab.tsx` | Volledig herschrijven |
| `src/components/settings/SettingsIntegrationsTab.tsx` | Volledig herschrijven |

Geen database-wijzigingen, geen nieuwe dependencies. Alle hooks en edge functions bestaan al.

