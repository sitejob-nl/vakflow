

# Plan: Uitgebreide Outlook Agenda-integratie

## Overzicht

Dit plan breidt de Outlook-integratie uit op drie niveaus:
1. **Per-gebruiker Outlook koppeling** — monteurs kunnen hun eigen Outlook koppelen
2. **Bidirectionele sync** — Vakflow-afspraken worden als events in de Outlook agenda van de toegewezen monteur geplaatst
3. **Outlook events in planning + route optimalisatie** — met pin/locatie-overrides

## Stap 1: Database — Nieuwe tabellen

### `user_outlook_tokens`
Slaat per monteur/admin een eigen Outlook refresh token op.

```sql
CREATE TABLE user_outlook_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  outlook_refresh_token text NOT NULL,
  outlook_email text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE user_outlook_tokens ENABLE ROW LEVEL SECURITY;
-- Gebruiker ziet alleen eigen token
CREATE POLICY "Users can view own token" ON user_outlook_tokens FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can insert own token" ON user_outlook_tokens FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can update own token" ON user_outlook_tokens FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can delete own token" ON user_outlook_tokens FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));
```

### `outlook_event_overrides`
Slaat pin-status en locatie-overrides op voor Outlook events (voor route optimalisatie).

```sql
CREATE TABLE outlook_event_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  user_id uuid NOT NULL,
  outlook_event_id text NOT NULL,
  pinned boolean DEFAULT false,
  location_override text,
  lat numeric,
  lng numeric,
  created_at timestamptz DEFAULT now(),
  UNIQUE(outlook_event_id, user_id)
);
ALTER TABLE outlook_event_overrides ENABLE ROW LEVEL SECURITY;
-- Company-scoped
CREATE POLICY "Company users can manage overrides" ON outlook_event_overrides
  FOR ALL TO authenticated
  USING (company_id = (SELECT get_my_company_id()))
  WITH CHECK (company_id = (SELECT get_my_company_id()));
```

### `appointments` — nieuw veld `outlook_event_id`
Slaat de ID op van het Outlook-event dat is aangemaakt toen de afspraak werd toegewezen.

```sql
ALTER TABLE appointments ADD COLUMN outlook_event_id text;
```

## Stap 2: Edge Functions aanpassen

### `outlook-auth-url` — personal scope
- Nieuw parameter `scope`: `"company"` (default) of `"personal"`
- Bij personal: userId in de HMAC-signed state meegeven

### `outlook-callback` — personal token opslaan
- Als state een userId bevat → opslaan in `user_outlook_tokens` i.p.v. `companies`

### `outlook-calendar` — meerdere bronnen
- Nieuw parameter `source`: `"company"`, `"personal"`, of `"all"`
- Bij personal: token uit `user_outlook_tokens` voor de ingelogde user
- Bij all: beide bronnen ophalen en mergen (met een `source` label per event)

### `outlook-calendar` — Vakflow→Outlook sync (create/update/delete)
- Bij het aanmaken/wijzigen van een afspraak met `assigned_to`:
  - Check of die monteur een persoonlijke Outlook token heeft
  - Zo ja: maak een Outlook event aan via Graph API met de afspraakgegevens
  - Sla het `outlook_event_id` op in de `appointments` tabel
- Bij verwijderen/wijzigen: update of verwijder het corresponderende Outlook event

## Stap 3: Frontend — Persoonlijke Outlook koppeling

### SettingsPage
- Nieuw blok onder E-mail tab (of apart kopje): "Jouw Outlook Agenda"
- "Koppel je Outlook" knop voor monteurs — roept `outlook-auth-url` aan met `scope: "personal"`
- Toont de gekoppelde e-mail als het al verbonden is, met een "Ontkoppelen" optie

### MonteurDashboardPage
- Optioneel: snelle "Koppel Outlook" banner als de monteur nog geen token heeft

## Stap 4: Planning UI — Outlook events interactief

### OutlookEventSheet (nieuw component)
- Opent bij klik op een Outlook event in de planning
- Toont: onderwerp, tijdstip, locatie
- Toggle: "Kan niet verzet worden" (pinned) → slaat op in `outlook_event_overrides`
- Locatie-invulveld als er geen locatie is → geocode via `google-maps-proxy` → slaat lat/lng op

### PlanningPage aanpassingen
- Outlook events klikbaar maken (opent OutlookEventSheet)
- Visuele 📌 indicator voor gepinde events
- Onderscheid bedrijfs-Outlook (paars) vs persoonlijke Outlook (blauw-paars)

## Stap 5: Route optimalisatie uitbreiden

### `optimize-route` edge function
- Naast Vakflow-afspraken ook Outlook events ophalen voor die dag/monteur
- Events met locatie (origineel of override) worden als waypoints meegenomen
- Gepinde events: `optimizeWaypointOrder` slaat deze over (ze worden als fixed points in de tijdlijn gehouden)
- Alleen Vakflow-afspraken worden daadwerkelijk verplaatst in de database

### Frontend pre-optimize dialog
- Voor het starten van optimalisatie: toon een lijst van Outlook events die dag
- Per event: checkbox "Kan niet verzet worden" en optioneel locatie invoeren
- Pas dan optimalisatie uitvoeren

## Stap 6: Vakflow→Outlook sync bij afspraak toewijzing

### `useCreateAppointment` / `useUpdateAppointment` aanpassen
- Na succesvolle create/update: als `assigned_to` is gezet, roep `outlook-calendar` aan met `action: "create"` of `action: "update"`
- Bij delete: roep `outlook-calendar` aan met `action: "delete"` als er een `outlook_event_id` is
- De edge function checkt of de monteur een persoonlijk Outlook token heeft — zo niet, skip

### AppointmentDialog
- Optionele checkbox: "Plaats in Outlook agenda van monteur" (default aan als monteur Outlook heeft)

## Bestanden die worden aangemaakt/aangepast

| Bestand | Actie |
|---------|-------|
| `supabase/migrations/...` | Nieuwe tabellen + appointments kolom |
| `supabase/functions/outlook-auth-url/index.ts` | Personal scope |
| `supabase/functions/outlook-callback/index.ts` | Personal token opslaan |
| `supabase/functions/outlook-calendar/index.ts` | Personal source + sync naar Outlook |
| `supabase/functions/optimize-route/index.ts` | Outlook events meenemen |
| `src/hooks/useOutlookCalendar.ts` | Meerdere bronnen |
| `src/hooks/useOutlookOverrides.ts` | Nieuw: CRUD voor overrides |
| `src/hooks/useAppointments.ts` | Outlook sync bij create/update/delete |
| `src/components/OutlookEventSheet.tsx` | Nieuw: detail/override sheet |
| `src/components/AppointmentDialog.tsx` | Outlook sync checkbox |
| `src/pages/PlanningPage.tsx` | Interactieve Outlook events |
| `src/pages/SettingsPage.tsx` | Persoonlijke Outlook koppeling |

## Implementatievolgorde

1. Database migraties (tabellen + kolom)
2. Edge functions (auth-url, callback, calendar — personal scope)
3. Settings UI voor persoonlijke Outlook koppeling
4. Outlook events interactief in planning (overrides)
5. Vakflow→Outlook sync bij afspraak toewijzing
6. Route optimalisatie met Outlook events

