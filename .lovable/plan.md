

## Plan

Twee fixes in de Outlook edge functions:

### 1. `outlook-auth-url/index.ts` — App origin meesturen in state
De `state` parameter wordt nu `companyId|https://app.vakflow.nl` zodat de callback weet waarheen te redirecten.

- Regel 69: state wijzigen van `${profile.company_id}` naar `${profile.company_id}|https://app.vakflow.nl`

### 2. `outlook-callback/index.ts` — State parsen + email_provider + redirect fix
- State splitsen op `|` om `companyId` en `appOrigin` te extraheren (met fallback `https://app.vakflow.nl`)
- `email_provider: "outlook"` toevoegen aan de company update (regel 115-118)
- Redirect URL gebruiken op basis van de `appOrigin` uit de state, niet `req.headers.get("origin")`

Beide functions worden opnieuw gedeployed.

