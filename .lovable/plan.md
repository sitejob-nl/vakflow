

## Analyse

Na het bestuderen van de SiteJob Connect documentatie en de huidige code zijn er **3 problemen** gevonden:

### Probleem 1: `webhook_secret` wordt niet opgeslagen
`whatsapp-register` ontvangt een `webhook_secret` van SiteJob Connect maar slaat deze **niet op**. Er is ook geen `webhook_secret` kolom in de `whatsapp_config` tabel. Gevolg: `whatsapp-config` en `whatsapp-webhook` verifiëren de `X-Webhook-Secret` header tegen de env var `WHATSAPP_WEBHOOK_SECRET`, die een andere waarde heeft dan wat Connect meestuurt. Alle inkomende calls van Connect worden dus geweigerd met 401.

### Probleem 2: Misleidende status check
`whatsapp-send` retourneert `connected: true` zodra er een rij bestaat, ook al staan `access_token` en `phone_number_id` op `"pending"`.

### Probleem 3: Stale registratie
De huidige config rij heeft `access_token: "pending"` en `phone_number_id: "pending"` — de OAuth-flow is nooit afgerond of de config-push is geblokkeerd door probleem 1.

---

## Implementatieplan

### Stap 1: Database migratie
- Voeg `webhook_secret TEXT` kolom toe aan `whatsapp_config`
- Verwijder de huidige "pending" rij zodat er schoon herregistreerd kan worden

### Stap 2: `whatsapp-register` — sla `webhook_secret` op
- Sla het `webhook_secret` uit de Connect-response op in `whatsapp_config.webhook_secret`

### Stap 3: `whatsapp-config` — verificatie tegen opgeslagen secret
- Lees `webhook_secret` uit `whatsapp_config` tabel
- Vergelijk `X-Webhook-Secret` header met opgeslagen waarde (fallback naar env var `WHATSAPP_WEBHOOK_SECRET`)
- Voeg `console.log` toe voor debugging

### Stap 4: `whatsapp-webhook` — zelfde verificatie-fix
- Verificeer `X-Webhook-Secret` tegen opgeslagen `webhook_secret` uit database (fallback naar env var)

### Stap 5: `whatsapp-send` — fix status check
- Retourneer `connected: false` als `access_token` of `phone_number_id` gelijk is aan `"pending"`
- Geef `tenant_id` wel mee zodat de UI weet dat registratie gelukt is maar OAuth nog niet is afgerond

