

## Plan: Volledige template-tekst tonen bij automations

### Probleem
De automation trigger stuurt een template via `whatsapp-send` zonder `preview` veld. `whatsapp-send` slaat dan `"Template: template_naam"` op in de chat — niet de werkelijke tekst.

### Aanpak

**1. `whatsapp-send/index.ts` — `contentSummary` aanpassen (regel 81)**

Wijzig:
```
case "template": return `Template: ${(body.template as any)?.name}`;
```
naar:
```
case "template": return (body.preview as string) || `Template: ${(body.template as any)?.name}`;
```

Dit is de fallback-logica: als `preview` meegegeven wordt, gebruik die. Anders de oude tekst.

**2. `whatsapp-automation-trigger/index.ts` — template body ophalen en preview bouwen**

Na het opbouwen van de `components` en vóór de `fetch` naar `whatsapp-send`:

- Haal de template content op via de Meta Graph API: `GET https://graph.facebook.com/v25.0/{waba_id}/message_templates?name={template_name}`
- Hiervoor moet de automation trigger eerst de `whatsapp_config` ophalen (access_token + waba_id) voor het bedrijf
- Extract de body-component tekst (bijv. `"Hallo {{1}}, uw afspraak is op {{2}}"`)
- Vervang de variabelen (`{{1}}`, `{{2}}`, of named `{{name}}`) met de resolved values uit de `parameters` array
- Stuur het resultaat mee als `preview` veld in de request body naar `whatsapp-send`

**3. Client-side (`WhatsAppChat.tsx` en `ComposeWhatsAppDialog.tsx`)**

Dezelfde aanpak voor handmatig verstuurde templates:
- De preview is al beschikbaar (berekend uit `activeTemplate.components`)
- Meesturen als `preview` veld in het request

### Bestanden die wijzigen

1. `supabase/functions/whatsapp-send/index.ts` — 1 regel in `contentSummary`
2. `supabase/functions/whatsapp-automation-trigger/index.ts` — whatsapp_config ophalen, Meta API call, preview bouwen, meesturen
3. `src/components/WhatsAppChat.tsx` — preview meesturen bij template-verzending
4. `src/components/ComposeWhatsAppDialog.tsx` — preview meesturen bij template-verzending

