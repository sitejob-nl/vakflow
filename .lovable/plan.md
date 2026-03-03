

## Plan: Outlook vereenvoudigen — globale credentials

Je hebt gelijk, het is onnodig complex. Eén Entra-app met de credentials als secrets, en elk bedrijf klikt gewoon op "Koppel Outlook". Geen Tenant ID of Client ID velden meer.

### Wat verandert

**1. Twee secrets toevoegen**
- `OUTLOOK_CLIENT_ID` — de Application (client) ID van jouw Entra-app
- `OUTLOOK_TENANT_ID` — stel in op `organizations` (of `common`) zodat elk Microsoft-account kan inloggen

**2. Edge functions aanpassen (4 bestanden)**
Alle functies lezen `client_id` en `tenant_id` uit `Deno.env.get()` i.p.v. uit de `companies` tabel:
- `outlook-callback` — token exchange gebruikt secrets
- `outlook-send` — token refresh gebruikt secrets  
- `outlook-calendar` — token refresh gebruikt secrets
- `send-email` — stopt met ophalen van `outlook_tenant_id`/`outlook_client_id`

**3. SettingsPage.tsx vereenvoudigen**
- Verwijder de invoervelden voor Tenant ID en Client ID
- Verwijder de state variabelen `outlookTenantId` en `outlookClientId`
- Eén knop: **"Koppel Outlook"** die de OAuth URL opbouwt met een call naar een simpele edge function die de auth URL teruggeeft (zodat de client_id niet in de frontend staat)
- Als gekoppeld: toon het e-mailadres + "Ontkoppel" knop

**4. Nieuwe edge function: `outlook-auth-url`**
Simpele authenticated function die de OAuth authorize URL retourneert met de globale credentials. De frontend opent die URL in een popup.

**5. save-smtp-credentials aanpassen**
Verwijder de `outlook_tenant_id` en `outlook_client_id` velden — die worden niet meer per bedrijf opgeslagen.

### Volgorde
1. Secrets `OUTLOOK_CLIENT_ID` en `OUTLOOK_TENANT_ID` opvragen
2. Edge functions updaten (callback, send, calendar, send-email)
3. Nieuwe `outlook-auth-url` function
4. SettingsPage UI vereenvoudigen
5. save-smtp-credentials opschonen

