

## Probleem: `Invalid key length` in `outlook-callback`

De `SMTP_ENCRYPTION_KEY` secret heeft geen geldige lengte voor AES-256-GCM. De `encrypt()` functie verwacht:
- **64 hex karakters** (= 32 bytes = 256 bits), of
- **Base64-encoded 32 bytes** (= 44 karakters)

Als de key een ander formaat of lengte heeft, faalt `crypto.subtle.importKey` met "Invalid key length".

Dit werkt waarschijnlijk al langer niet — de `send-email` functie gebruikt dezelfde key voor **decryptie** van SMTP-wachtwoorden, dus als die wel werkt, is de key waarschijnlijk correct maar in een onverwacht formaat.

### Oplossing

De `encrypt()` functie robuuster maken met een SHA-256 hash als fallback. Als de key niet exact 32 bytes oplevert via hex of base64, hashen we de ruwe key-string naar exact 32 bytes met SHA-256. Dit is veilig en zorgt dat elke willekeurige string als key werkt.

**Bestanden:**
- `supabase/functions/outlook-callback/index.ts` — encrypt functie aanpassen
- `supabase/functions/save-smtp-credentials/index.ts` — zelfde encrypt functie, ook aanpassen voor consistentie

De `decrypt` functies in `send-email`, `outlook-send`, en `outlook-calendar` moeten **niet** aangepast worden — die werken al correct met de huidige key (omdat bestaande encrypted data met het huidige formaat is opgeslagen).

De aanpassing: als de key niet precies 64 hex chars is en ook niet valid base64 van 32 bytes oplevert, gebruik `SHA-256(keyString)` om altijd 32 bytes te krijgen.

