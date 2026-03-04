

## Plan: Betere Meta API foutmeldingen in WhatsApp

### Probleem
Wanneer een WhatsApp bericht faalt (bijv. geen betaalmethode, 24-uurs venster verlopen, rate limit), toont het systeem alleen de generieke melding "Bericht kon niet worden verstuurd". De specifieke Meta API error details worden weggegooid.

### Oplossing

**1. `supabase/functions/whatsapp-send/index.ts` -- Meta error parsing (regel 225-228)**

Voeg een mapping toe van bekende Meta error codes naar Nederlandse foutmeldingen:

```typescript
const META_ERROR_MAP: Record<number, string> = {
  131042: "Geen betaalmethode gekoppeld in Meta Business Suite",
  131047: "Klant heeft 24+ uur niet gereageerd — gebruik een template",
  131026: "Bericht kon niet worden afgeleverd (nummer onbereikbaar)",
  131051: "Dit berichttype wordt niet ondersteund",
  130429: "Te veel berichten verstuurd — probeer later opnieuw",
  131021: "Ontvanger is geen WhatsApp-gebruiker",
  131031: "Bedrijfsaccount is geblokkeerd door Meta",
  131056: "Template is afgekeurd of gepauzeerd",
  131009: "Parameter ontbreekt of is ongeldig",
  190:    "Toegangstoken verlopen — koppel WhatsApp opnieuw",
};
```

Wijzig de error response (regel 226-228) om de Meta error te parsen:

```typescript
if (!metaRes.ok) {
  const metaError = result?.error;
  const code = metaError?.code;
  const subcode = metaError?.error_subcode;
  const friendlyMsg = META_ERROR_MAP[subcode] || META_ERROR_MAP[code] 
    || metaError?.error_data?.details 
    || metaError?.message 
    || "Bericht kon niet worden verstuurd";
  console.error("Meta API error:", JSON.stringify(result));
  return jsonRes({ 
    error: friendlyMsg, 
    code: "META_SEND_FAILED",
    meta_code: code,
    meta_subcode: subcode,
  }, metaRes.status);
}
```

**2. `src/hooks/useWhatsApp.ts` -- Error doorsturen**

Geen wijziging nodig. De `data.error` wordt al als Error message gegooid en getoond via toast. De nieuwe `friendlyMsg` komt automatisch door.

### Bestanden die wijzigen

1. `supabase/functions/whatsapp-send/index.ts` -- error mapping + verbeterde error response

