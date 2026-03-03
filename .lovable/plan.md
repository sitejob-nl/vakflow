

## Probleem

De `fetch-emails` edge function heeft geen Outlook-ondersteuning. Het controleert niet de `email_provider` van het bedrijf en probeert altijd via IMAP te verbinden met SMTP-credentials. Voor een Outlook-gekoppeld bedrijf (zoals SiteJob met kas@sitejob.nl) zijn die SMTP-credentials er niet, waardoor het faalt.

Ter vergelijking: `send-email` checkt wél `email_provider === "outlook"` en stuurt dan door naar `outlook-send`. Dezelfde logica ontbreekt bij fetch.

## Oplossing

De `fetch-emails` edge function aanpassen om:

1. **Company data ophalen** inclusief `email_provider`, `outlook_refresh_token`, `outlook_email`
2. **Als `email_provider === "outlook"`**: Microsoft Graph API gebruiken om e-mails op te halen via `GET /me/messages` met de access token (verkregen door de refresh token te decrypten en te refreshen)
3. **Anders**: bestaande IMAP-logica gebruiken (ongewijzigd)

### Technisch detail: Outlook e-mail ophalen via Graph API

De Graph API call:
```
GET https://graph.microsoft.com/v1.0/me/messages?$filter=isRead eq false&$top=50&$select=id,subject,from,receivedDateTime,body,isRead
```

Na het ophalen: berichten markeren als gelezen via `PATCH /me/messages/{id}` met `{ isRead: true }`.

De token-refresh logica is identiek aan wat `outlook-send` al doet (refresh token decrypten → token endpoint aanroepen → access token gebruiken).

### Aanpassing in `supabase/functions/fetch-emails/index.ts`

- Na de auth check: company data ophalen met `email_provider`, `outlook_refresh_token`
- Als outlook: decrypt refresh token → get access token → fetch via Graph API → insert in `communication_logs` → mark as read
- Als SMTP: bestaande IMAP-logica (ongewijzigd)

Eén bestand, één edge function, opnieuw deployen.

