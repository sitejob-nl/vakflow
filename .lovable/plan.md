

## Plan: Outlook integratie voltooien (Mail + Agenda) ✅ VOLTOOID

### Wat is gedaan
1. ✅ **OUTLOOK_CLIENT_SECRET** toegevoegd als Supabase secret
2. ✅ **OAuth scopes** uitgebreid naar `Mail.Send Calendars.ReadWrite offline_access` in:
   - `outlook-callback/index.ts`
   - `outlook-send/index.ts`
   - `SettingsPage.tsx`
3. ✅ **`outlook-calendar` edge function** aangemaakt met CRUD operaties (list, create, update, delete)
4. ✅ **`useOutlookCalendar` hook** aangemaakt
5. ✅ **PlanningPage** uitgebreid met Outlook-toggle en paarse Outlook-events in het weekoverzicht

### Belangrijk
- Bestaande Outlook-koppelingen moeten **opnieuw geautoriseerd** worden (via Instellingen → Opnieuw koppelen) om de nieuwe `Calendars.ReadWrite` scope te activeren
- In de Entra app-registratie moet de **Calendars.ReadWrite** (Delegated) permission handmatig worden toegevoegd
