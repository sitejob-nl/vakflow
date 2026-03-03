

## Probleem

De scopes staan correct in Azure, maar worden **niet aangevraagd** in de OAuth-flow. De `outlook-auth-url` en `outlook-callback` vragen alleen `Mail.Send Calendars.ReadWrite offline_access` aan. Het huidige refresh token bevat dus geen `Mail.Read` permissie. Bij een token refresh kun je geen nieuwe scopes toevoegen die niet in het originele token zitten.

## Oplossing

De scope string uitbreiden in **4 bestanden** zodat `Mail.Read` en `Mail.ReadWrite` vanaf het begin worden aangevraagd:

| Bestand | Regel | Huidige scope | 
|---------|-------|---------------|
| `outlook-auth-url/index.ts` | 67 | `Mail.Send Calendars.ReadWrite offline_access` |
| `outlook-callback/index.ts` | 95 | `Mail.Send Calendars.ReadWrite offline_access` |
| `outlook-send/index.ts` | 57 | `Mail.Send Calendars.ReadWrite offline_access` |
| `outlook-calendar/index.ts` | 57 | `Mail.Send Calendars.ReadWrite offline_access` |

Allemaal wijzigen naar:
```
https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/Calendars.ReadWrite offline_access
```

(`fetch-emails` heeft dit al correct.)

**Na het deployen moet SiteJob opnieuw Outlook koppelen** via Instellingen, zodat het nieuwe refresh token de Mail.Read scope bevat.

