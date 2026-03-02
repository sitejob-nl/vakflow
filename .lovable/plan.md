

## Plan: Outlook integratie voltooien (Mail + Agenda)

### Huidige situatie
- Edge functions `outlook-callback` en `outlook-send` bestaan al
- Settings UI heeft Tenant ID en Client ID velden
- **Ontbrekend**: het secret `OUTLOOK_CLIENT_SECRET` is nog niet geconfigureerd in Supabase
- OAuth scope is beperkt tot `Mail.Send offline_access` -- agenda ontbreekt

### Stappen

#### 1. Secret toevoegen: `OUTLOOK_CLIENT_SECRET`
Het Client Secret uit de Entra app-registratie moet als Supabase secret worden opgeslagen. Dit is een globaal secret (niet per bedrijf) dat door de edge functions wordt gebruikt.

#### 2. OAuth scopes uitbreiden met Calendar
In `outlook-callback/index.ts` en `SettingsPage.tsx` de scope uitbreiden naar:
```
Mail.Send Calendars.ReadWrite offline_access
```
Bestaande koppelingen moeten opnieuw geautoriseerd worden voor de nieuwe scope.

#### 3. Nieuwe Edge Function: `outlook-calendar`
CRUD operaties via Microsoft Graph Calendar API:
- `list`: `GET /me/calendarView?startDateTime=...&endDateTime=...`
- `create`: `POST /me/events`
- `update`: `PATCH /me/events/{id}`
- `delete`: `DELETE /me/events/{id}`

Hergebruikt de decrypt + token-refresh logica uit `outlook-send`.

#### 4. Frontend: Planning-pagina integratie
- Hook `useOutlookCalendar.ts` die de edge function aanroept
- Toggle in `PlanningPage.tsx` om Outlook-events te tonen
- Outlook-events in een andere kleur (bijv. blauw/paars) om ze te onderscheiden van Vakflow-afspraken
- Alleen-lezen weergave (geen drag & drop voor externe events)

#### 5. Settings UI uitbreiden
- Indicator dat agenda ook gekoppeld is na re-autorisatie
- Melding dat opnieuw koppelen nodig is als de scope is gewijzigd

### Volgorde
1. Secret `OUTLOOK_CLIENT_SECRET` opvragen en opslaan
2. Scopes updaten in callback + settings
3. `outlook-calendar` edge function bouwen
4. `useOutlookCalendar` hook + planning integratie

