

## E-mail Templates & Automatiseringen

### Wat wordt gebouwd

1. **Nieuwe tabel `email_templates`** — Opslaan van herbruikbare HTML e-mailtemplates per bedrijf
2. **HTML E-mail Template Builder** — Een visuele editor in de Instellingen pagina waar gebruikers templates kunnen maken met bedrijfslogo, kleuren, en variabelen (bijv. `{{klantnaam}}`, `{{werkbonnummer}}`)
3. **E-mail Automatiseringen** — Uitbreiding van het bestaande "Automatiseringen" tabblad in Instellingen zodat naast WhatsApp ook e-mail automatiseringen ingesteld kunnen worden (bijv. bij afgeronde werkbon, factuur verzonden, etc.)

### Database

**Nieuwe tabel: `email_templates`**

| Kolom | Type | Omschrijving |
|-------|------|-------------|
| id | uuid PK | |
| company_id | uuid NOT NULL | |
| name | text NOT NULL | Templatenaaam |
| subject | text | Standaard onderwerp |
| html_body | text NOT NULL | HTML-inhoud met variabelen |
| variables | jsonb | Lijst beschikbare variabelen |
| created_at | timestamptz | |
| updated_at | timestamptz | |

Met RLS-policies op basis van `company_id = get_my_company_id()`.

**Uitbreiding `auto_message_settings`**: bestaande tabel ondersteunt al `channel: "email" | "whatsapp" | "both"` en `custom_text`. We voegen een kolom `email_template_id uuid` toe die verwijst naar `email_templates`.

### Frontend componenten

**1. E-mail Template Builder** (nieuw component `EmailTemplateEditor.tsx`)
- Bewerkbare secties: header (met bedrijfslogo upload), body (rich text met variabelen), footer
- Live preview via sandboxed iframe (patroon bestaat al in `EmailPage.tsx`)
- Variabelen invoegen via knoppen: `{{klantnaam}}`, `{{werkbonnummer}}`, `{{factuurnummer}}`, `{{bedrag}}`, `{{datum}}`
- Bedrijfslogo wordt automatisch ingeladen vanuit `companies.logo_url`
- Kleurthema gebaseerd op `companies.brand_color`

**2. E-mail Templates tab** (in SettingsPage, nieuw tabblad "E-mail Templates")
- Lijst van bestaande templates met preview
- CRUD: aanmaken, bewerken, verwijderen
- Standaard starttemplates (bijv. "Werkbon afgerond", "Factuur bijgevoegd")

**3. Automatiseringen tab uitbreiden**
- Huidige tab toont alleen WhatsApp automatiseringen
- Twee secties toevoegen: "WhatsApp Automatiseringen" (bestaand) en "E-mail Automatiseringen" (nieuw)
- E-mail automatisering: kies trigger (zelfde `TRIGGER_TYPES` als WhatsApp) → kies e-mail template → aan/uit
- Opslaan in `auto_message_settings` met `channel: "email"` en `email_template_id`

### Hooks

- `useEmailTemplates.ts` — CRUD hook voor `email_templates` tabel
- Uitbreiding `useAutoMessageSettings.ts` — ondersteuning voor `email_template_id`

### Bestanden

| Bestand | Actie |
|---------|-------|
| Migration SQL | Maak `email_templates` tabel + voeg `email_template_id` kolom toe aan `auto_message_settings` |
| `src/hooks/useEmailTemplates.ts` | Nieuw — CRUD voor email templates |
| `src/components/EmailTemplateEditor.tsx` | Nieuw — HTML template builder met logo, variabelen, preview |
| `src/pages/SettingsPage.tsx` | Voeg "E-mail Templates" tab toe + breid "Automatiseringen" tab uit met e-mail sectie |
| `src/hooks/useAutoMessageSettings.ts` | Voeg `email_template_id` toe aan interface |

