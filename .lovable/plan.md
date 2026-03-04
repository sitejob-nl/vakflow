

## Probleem analyse

Er zijn twee problemen:

### 1. Token "verdwijnt" na herladen

De `companies_safe` view (die de frontend gebruikt om instellingen te laden) bevat **geen** `eboekhouden_api_token` veld — dit is bewust, voor beveiliging. Maar er is ook geen indicator of de token wl is ingesteld.

De UI bepaalt `ebConnected` op basis van `eboekhouden_ledger_id`. Als je alleen een token opslaat (zonder template/ledger te configureren), denkt de UI dat er geen verbinding is, en toont het veld "Plak hier je token" in plaats van "ongewijzigd".

### 2. e-Boekhouden login mislukt

De logs tonen: `"Login failed", status: 400`. Dit betekent dat de token correct wordt ontsleuteld en verstuurd, maar dat e-Boekhouden de credentials afwijst. Dit is waarschijnlijk een onjuiste API-token (verkeerde waarde of verlopen).

### Plan

**1. `companies_safe` view aanpassen** — een boolean kolom `has_eboekhouden_token` toevoegen:
```sql
(eboekhouden_api_token IS NOT NULL AND eboekhouden_api_token <> '') AS has_eboekhouden_token
```

**2. Frontend `SettingsPage.tsx` aanpassen**:
- Bij het laden: `setEbConnected` baseren op `has_eboekhouden_token` (uit de view) in plaats van `eboekhouden_ledger_id`
- Na opslaan: `setEbConnected(true)` als er een token was ingevuld of al bestond

**3. Login-fout**: Dit is geen code-probleem maar een configuratieprobleem. De API-token die voor MV Solutions is ingevoerd wordt afgewezen door e-Boekhouden. Na de UI-fix kan de token correct worden bewaard en is het duidelijk of deze al is opgeslagen. De gebruiker moet verifiëren dat de token klopt in het e-Boekhouden portaal.

### Technische details

- Migration: `ALTER VIEW` voor `companies_safe` met extra computed kolom
- SettingsPage regel ~562: wijzig `setEbConnected` check
- SettingsPage regel ~739: wijzig `setEbConnected` na save
- Geen wijzigingen aan edge functions nodig

