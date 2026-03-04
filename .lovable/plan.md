

## Analyse

Het probleem is duidelijk: de HTML-template wordt als **platte tekst** verstuurd in plaats van als HTML.

De keten werkt zo:
1. `CustomerEmailTab` stuurt `{ to, subject, body: resolvedBody }` via `useSendEmail`
2. `useSendEmail` stuurt alleen `{ to, subject, body }` naar de edge function
3. `send-email` edge function zet `body` als `content` (platte tekst) en kijkt naar een apart `html` veld voor HTML-opmaak — maar dat veld wordt nooit meegegeven

### Oplossing

**1. `useSendEmail` hook uitbreiden** (`src/hooks/useCommunicationLogs.ts` regel 63-84):
- Parameter type uitbreiden met optioneel `html` veld
- Het `html` veld meesturen naar de edge function

**2. `CustomerEmailTab` aanpassen** (`src/components/CustomerEmailTab.tsx`):
- Bij template versturen: `html_body` meesturen als `html` parameter (naast `body` als fallback platte tekst)
- Bij vrije e-mail: alleen `body` blijft als platte tekst (tenzij je daar ook HTML wilt)

### Bestanden

1. `src/hooks/useCommunicationLogs.ts` — `html` toevoegen aan `useSendEmail` params
2. `src/components/CustomerEmailTab.tsx` — `html` meesturen bij template e-mails

