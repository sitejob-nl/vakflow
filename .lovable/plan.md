

## Probleem

De `decryptPassword` functie in `fetch-emails/index.ts` mist de SHA-256 fallback die wél aanwezig is in `outlook-callback` en `save-smtp-credentials`. Wanneer de `SMTP_ENCRYPTION_KEY` geen geldige 64-char hex is, probeert het base64-decode en krijgt geen 32 bytes, waardoor `importKey` crasht met "Invalid key length".

## Oplossing

In `supabase/functions/fetch-emails/index.ts`, regels 31-36 aanpassen: na de base64 poging een length-check toevoegen en bij falen een SHA-256 hash van de key string maken (exact zoals de encrypt-kant doet).

**Wijziging (regels 31-36):**

Van:
```typescript
let keyBytes: Uint8Array;
if (keyHex.length === 64 && /^[0-9a-fA-F]+$/.test(keyHex)) {
  keyBytes = hexToBytes(keyHex);
} else {
  keyBytes = base64ToBytes(keyHex);
}
```

Naar:
```typescript
let keyBytes: Uint8Array;
if (keyHex.length === 64 && /^[0-9a-fA-F]+$/.test(keyHex)) {
  keyBytes = hexToBytes(keyHex);
} else {
  try {
    keyBytes = base64ToBytes(keyHex);
    if (keyBytes.length !== 32) throw new Error("not 32 bytes");
  } catch {
    keyBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(keyHex)));
  }
}
```

Eén bestand, opnieuw deployen.

