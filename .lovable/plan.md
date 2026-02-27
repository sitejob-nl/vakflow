

## Plan: Multi-integratie systeem (boekhouding + e-mail)

Dit is een groot feature dat de volledige integratie-architectuur uitbreidt. Hieronder het stapsgewijze plan.

---

### Stap 1: Database-uitbreiding

Twee nieuwe kolommen toevoegen aan de `companies` tabel:

- `accounting_provider` (text, nullable) — waarden: `eboekhouden`, `exact`, `rompslomp`, `moneybird`, of `null`
- `email_provider` (text, nullable) — waarden: `smtp`, `outlook`, of `null`

Plus extra kolommen voor Outlook OAuth:
- `outlook_tenant_id` (text, nullable)
- `outlook_client_id` (text, nullable)
- `outlook_refresh_token` (text, nullable) — versleuteld opgeslagen
- `outlook_email` (text, nullable)

---

### Stap 2: Onboarding uitbreiden

Het huidige `OnboardingDialog` is een simpele rondleiding. Een nieuwe stap toevoegen (of een apart onboarding-scherm na de rondleiding) waar het bedrijf kiest:

1. **Boekhoudpakket**: e-Boekhouden / Exact Online / Rompslomp / Moneybird / Geen
2. **E-mail provider**: Outlook / SMTP / Geen

Deze keuzes worden opgeslagen in `companies.accounting_provider` en `companies.email_provider`.

---

### Stap 3: Instellingen-pagina aanpassen

De huidige tabs array wijzigen zodat:

- De tab "e-Boekhouden" wordt vervangen door een dynamische "Boekhouding" tab die alleen de instellingen toont van de gekozen provider
- De SMTP-sectie (nu onder "App-voorkeuren") wordt verplaatst naar een eigen "E-mail" tab die Outlook of SMTP toont op basis van keuze
- Een "Koppelingen" tab toevoegen waar het bedrijf van provider kan wisselen

**Per accounting provider:**
- **e-Boekhouden**: Bestaande flow (API token, sjablonen, grootboeken)
- **Exact Online**: OAuth flow via SiteJob Connect — client ID, redirect, token opslag
- **Rompslomp**: API key configuratie
- **Moneybird**: OAuth flow of API token

**Per email provider:**
- **SMTP**: Bestaande flow (host, port, user, pass)
- **Outlook**: OAuth via Microsoft Entra — tenant ID, client ID, redirect URI, consent flow

---

### Stap 4: Outlook Edge Function

Nieuwe edge function `outlook-send` aanmaken die:
- Outlook refresh token uit de database haalt
- Access token ophaalt via Microsoft OAuth2 token endpoint
- E-mail verstuurt via Microsoft Graph API (`/me/sendMail`)

Plus `outlook-callback` edge function voor de OAuth callback.

---

### Stap 5: Send-email functie aanpassen

De bestaande `send-email` edge function uitbreiden:
- Check `companies.email_provider`
- Als `outlook`: gebruik Microsoft Graph API
- Als `smtp`: bestaande SMTP flow

---

### Stap 6: Toekomstige boekhouding edge functions

Placeholder edge functions voor Exact/Rompslomp/Moneybird (vergelijkbaar met `sync-invoice-eboekhouden`). De daadwerkelijke API-integratie kan later per provider worden ingevuld wanneer de API credentials beschikbaar zijn.

---

### Technische details

**Database migratie SQL:**
```sql
ALTER TABLE companies
  ADD COLUMN accounting_provider text,
  ADD COLUMN email_provider text DEFAULT 'smtp',
  ADD COLUMN outlook_tenant_id text,
  ADD COLUMN outlook_client_id text,
  ADD COLUMN outlook_refresh_token text,
  ADD COLUMN outlook_email text;
```

**Bestanden die worden aangemaakt/gewijzigd:**
- `src/components/OnboardingDialog.tsx` — keuze-stap toevoegen
- `src/pages/SettingsPage.tsx` — dynamische tabs op basis van provider
- `supabase/functions/outlook-send/index.ts` — nieuw
- `supabase/functions/outlook-callback/index.ts` — nieuw
- `supabase/functions/send-email/index.ts` — router op basis van provider
- `supabase/functions/save-smtp-credentials/index.ts` — Outlook velden toevoegen

**Nieuwe secrets nodig:**
- `OUTLOOK_CLIENT_SECRET` — voor Microsoft Entra app (user moet deze zelf aanmaken)

