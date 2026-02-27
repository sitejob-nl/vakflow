

## Multi-tenant SaaS Omzetting — Fase-plan

Dit is een omvangrijke architectuur-wijziging die in fases wordt uitgevoerd. Hieronder het volledige plan.

---

### Fase 1: Database fundament

**1a. `companies` tabel aanmaken**
- Kolommen: `id`, `name`, `slug` (uniek), `kvk_number`, `btw_number`, `address`, `postal_code`, `city`, `phone`, `iban`, `logo_url`, `smtp_email`, `smtp_password`, `smtp_host`, `smtp_port`, `eboekhouden_api_token`, `eboekhouden_ledger_id`, `eboekhouden_template_id`, `eboekhouden_debtor_ledger_id`, `created_at`
- Bedrijfsgegevens verhuizen van `profiles` naar `companies`

**1b. `company_id` kolom toevoegen aan alle relevante tabellen:**
- `profiles` (welk bedrijf hoort deze user bij)
- `customers`
- `addresses`
- `appointments`
- `work_orders`
- `invoices`
- `quotes`
- `quote_templates`
- `services`
- `communication_logs`
- `whatsapp_messages`
- `whatsapp_config`
- `whatsapp_automations`
- `auto_message_settings`
- `automation_send_log`
- `todos`
- `notifications`

**1c. `user_roles` aanpassen**
- Toevoegen: `company_id` kolom
- Nieuwe enum waarde: `super_admin` (of aparte `platform_role` kolom)
- Rollen worden nu per bedrijf toegewezen

**1d. Security definer functies**
- `get_my_company_id(user_id uuid) → uuid` — haalt company_id op uit profiles
- `has_company_role(user_id uuid, company_id uuid, role app_role) → boolean`
- `is_super_admin(user_id uuid) → boolean`

**1e. RLS policies herschrijven**
Alle tabellen krijgen policies die filteren op `company_id = get_my_company_id(auth.uid())`. Super admins krijgen leesrechten op alles.

**1f. Migratie bestaande data**
- Nieuw `companies` record aanmaken met jouw bedrijfsgegevens (uit `profiles`)
- Alle bestaande rijen in bovenstaande tabellen krijgen `company_id` van jouw bedrijf
- Jouw user krijgt `super_admin` rol

---

### Fase 2: Auth & Registratie flow

**2a. Company signup pagina**
- Formulier: bedrijfsnaam, KVK, email, wachtwoord, naam eigenaar
- Maakt `companies` record + user account + admin rol aan (via edge function)

**2b. Uitnodigings-flow aanpassen**
- `invite-user` edge function: `company_id` meegeven
- Uitgenodigde user wordt automatisch aan het juiste bedrijf gekoppeld

**2c. AuthContext uitbreiden**
- `company_id` opslaan in context
- `isSuperAdmin` boolean toevoegen
- Company-gegevens ophalen bij login

---

### Fase 3: UI aanpassingen

**3a. Alle hooks aanpassen**
- Queries hoeven niet handmatig te filteren op `company_id` — RLS doet dat. Maar inserts moeten `company_id` meegeven.

**3b. Instellingen pagina opsplitsen**
- Bedrijfsgegevens → uit `companies` tabel lezen/schrijven (niet meer uit `profiles`)
- WhatsApp/SMTP/e-Boekhouden → per company

**3c. Teamleden beheer**
- Toon alleen gebruikers van eigen bedrijf
- Rollen toewijzen per bedrijf

**3d. Super admin dashboard** (later)
- Overzicht van alle bedrijven
- Bedrijf aanmaken/bewerken/verwijderen
- Impersonate / support-modus

---

### Volgorde van implementatie

We beginnen met **Fase 1** (database), dan **Fase 2** (auth), dan **Fase 3** (UI). Elke fase wordt als apart bericht geïmplementeerd zodat je tussendoor kunt testen.

### Technische details

```text
companies (nieuw)
├── id (uuid, PK)
├── name (text)
├── slug (text, unique)
├── kvk_number, btw_number, iban, etc.
├── smtp_*, eboekhouden_* (verhuisd uit profiles)
└── created_at

profiles (aangepast)
├── id (uuid, FK → auth.users)
├── company_id (uuid, FK → companies)  ← NIEUW
├── full_name, phone, location
└── onboarding_completed

user_roles (aangepast)
├── user_id (uuid)
├── company_id (uuid)  ← NIEUW
├── role (app_role)  ← 'super_admin' toegevoegd aan enum
└── unique(user_id, company_id, role)

Alle andere tabellen:
├── company_id (uuid, FK → companies)  ← NIEUW
└── RLS: company_id = get_my_company_id(auth.uid())
```

