

## Plan: Test e-mail versturen + WhatsApp template variabelen mapping verbeteren

### Feature 1: Test e-mail sturen vanuit template

Een "Test versturen" knop toevoegen naast elk e-mail template in de lijst. Bij klikken wordt het template verstuurd naar het e-mailadres van de ingelogde gebruiker, met voorbeeldwaarden voor alle variabelen.

**Wijzigingen:**

1. **`src/pages/SettingsPage.tsx`** -- Bij elk template in de lijst (regel 3154-3179) een "Test" knop toevoegen
   - Bij klik: variabelen vervangen met voorbeeldwaarden (`{{klantnaam}}` → "Jan de Vries", `{{werkbonnummer}}` → "WB-2026-0001", etc.)
   - `supabase.functions.invoke("send-email", { body: { to: user.email, subject, body: plainText, html: resolvedHtml } })` aanroepen
   - Toast tonen met succes/fout

2. **Voorbeeldwaarden mapping** (inline in SettingsPage):
   ```
   klantnaam → "Jan de Vries"
   werkbonnummer → "WB-2026-0001"
   factuurnummer → "F-2026-001"
   bedrag → "€ 250,00"
   datum → huidige datum
   bedrijfsnaam → bedrijfsnaam uit profiel
   adres → bedrijfsadres uit profiel
   ```

### Feature 2: WhatsApp template variabelen beter mappen

Momenteel moet de gebruiker handmatig een parameternummer/-naam invullen. Dit wordt vervangen door een duidelijkere UI waar de template-variabelen automatisch gedetecteerd worden en via een dropdown gekoppeld kunnen worden aan beschikbare waarden.

**Wijzigingen in `src/pages/SettingsPage.tsx`** (regel 3318-3353):

- Huidige flow: lijst van beschikbare velden met een vrij tekstveld voor het parameternummer
- Nieuwe flow: lijst van **template parameters** (uit de body tekst gedetecteerd, bijv. `{{1}}`, `{{2}}` of `{{name}}`) met een **Select dropdown** per parameter om een beschikbaar veld te kiezen (Klantnaam, Datum, Tijd, etc.)
- De template body-tekst tonen als preview zodat de gebruiker ziet welke variabelen er zijn
- Mapping wordt omgedraaid: van "template param → beschikbaar veld" met dropdown in plaats van vrije invoer

### Bestanden die wijzigen

1. `src/pages/SettingsPage.tsx` -- Test-knop bij email templates + WhatsApp variabelen mapping UI

