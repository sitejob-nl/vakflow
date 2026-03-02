

## Plan: Bedrijfslogo uploaden en tonen in de app

Het doel is dat elk bedrijf een eigen logo kan uploaden dat overal in de app wordt getoond (sidebar, header, login) — zodat het aanvoelt als hun eigen software.

### Wat er al is
- `companies` tabel heeft al een `logo_url` kolom (text, nullable)
- Geen storage bucket voor logo's nog

### Implementatie

**1. Storage bucket aanmaken** (migratie)
- Nieuwe public bucket `company-logos` zodat logo's direct via URL bereikbaar zijn
- RLS policies: authenticated users mogen uploaden/verwijderen in hun eigen company folder

**2. Logo upload in Instellingen** (`src/pages/SettingsPage.tsx`)
- Bij de tab "Bedrijfsgegevens" een logo upload veld toevoegen
- Preview van het huidige logo tonen
- Upload naar `company-logos/{company_id}/logo.png`
- Na upload: `logo_url` kolom in `companies` bijwerken met de public URL
- Verwijder-optie om terug te vallen op het standaard Vakflow logo

**3. AuthContext uitbreiden** (`src/contexts/AuthContext.tsx`)
- `companyLogoUrl` toevoegen aan de context
- Bij `fetchUserData` de company `logo_url` ophalen en beschikbaar stellen
- Meenemen bij impersonation (logo van ge-impersoneerd bedrijf tonen)

**4. Logo tonen in Sidebar** (`src/components/Sidebar.tsx`)
- Huidige hardcoded `logo-full.png` vervangen door: als `companyLogoUrl` bestaat → bedrijfslogo, anders → Vakflow logo als fallback

**5. Logo tonen in Header** (`src/components/Header.tsx`)
- Zelfde logica: `companyLogoUrl` → bedrijfslogo, anders → standaard `logo.png`

### Bestanden
- Nieuwe migratie: bucket `company-logos` + RLS policies
- `src/contexts/AuthContext.tsx` — `companyLogoUrl` toevoegen
- `src/pages/SettingsPage.tsx` — upload UI bij Bedrijfsgegevens tab
- `src/components/Sidebar.tsx` — dynamisch logo
- `src/components/Header.tsx` — dynamisch logo

