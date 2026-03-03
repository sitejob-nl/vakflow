

## Analyse

Drie problemen gevonden:

### 1. Verzonden mails belanden in "Inbox" map
Bij het versturen via de compose dialog wordt `folder_name` niet meegegeven in de `createLog.mutateAsync()` call (regel 196-205). De database default is `'inbox'`, dus verzonden mails verschijnen in de Inbox-map in plaats van Verzonden.

### 2. Mailmappen worden WEL opgehaald
De `fetch-emails` edge function haalt correct `inbox`, `sentitems` en `drafts` op via de Graph API `mailFolders` endpoint en slaat `folder_name` correct op. Dit werkt dus al goed.

### 3. Geen automatische verversing
Er is geen Supabase Realtime subscription op `communication_logs`. Nieuwe mails verschijnen pas na handmatig "Ophalen" klikken.

---

## Oplossing

### A. Fix folder_name bij verzenden (EmailPage.tsx)
In de `handleSend` functie `folder_name: "sent"` meezetten bij het aanmaken van de communication_log.

### B. Visueel onderscheid verbeteren (EmailPage.tsx)
- Inbound mails: blauw/primary bolletje + pijl-icoon
- Outbound mails: grijs bolletje + ander icoon of "Aan:" prefix (dit zit er al deels in)
- Folder tabs duidelijker markeren welke actief is

### C. Realtime subscription toevoegen (EmailPage.tsx)
- `useEffect` met Supabase `.channel('communication_logs').on('postgres_changes', ...)` subscription
- Bij `INSERT` event automatisch `queryClient.invalidateQueries(["communication_logs"])` aanroepen
- Zo verschijnen nieuw opgehaalde mails direct zonder herladen

### Bestanden die wijzigen

| Bestand | Wijziging |
|---------|-----------|
| `src/pages/EmailPage.tsx` | folder_name fix, realtime subscription, visueel onderscheid |

