

## Probleem

De `outlook-send` edge function crasht met `DataError: Invalid key length` bij het ontsleutelen van het Outlook refresh token. Dit komt omdat de `decrypt` functie in `outlook-send` een simplere versie is dan die in `fetch-emails`.

`fetch-emails` heeft een fallback: als de `SMTP_ENCRYPTION_KEY` geen geldige 32-byte hex of base64 is, wordt de key door SHA-256 gehasht tot exact 32 bytes. `outlook-send` mist deze fallback en crasht.

Hetzelfde probleem bestaat in `send-email` (die dezelfde simpele decrypt gebruikt).

## Oplossing

De `decrypt`/`decryptPassword` functie in **2 bestanden** updaten met dezelfde fallback-logica als `fetch-emails`:

| Bestand | Wijziging |
|---------|-----------|
| `supabase/functions/outlook-send/index.ts` | Fallback toevoegen: als base64 key niet 32 bytes is, hash met SHA-256 |
| `supabase/functions/send-email/index.ts` | Zelfde fallback toevoegen |

De gewijzigde decrypt functie wordt:
```typescript
async function decrypt(encryptedStr: string): Promise<string> {
  const keyHex = Deno.env.get("SMTP_ENCRYPTION_KEY");
  if (!keyHex) throw new Error("SMTP_ENCRYPTION_KEY not configured");

  let keyBytes: Uint8Array;
  if (keyHex.length === 64 && /^[0-9a-fA-F]+$/.test(keyHex)) {
    keyBytes = hexToBytes(keyHex);
  } else {
    try {
      keyBytes = base64ToBytes(keyHex);
      if (keyBytes.length !== 32) throw new Error("not 32 bytes");
    } catch {
      keyBytes = new Uint8Array(
        await crypto.subtle.digest("SHA-256", new TextEncoder().encode(keyHex))
      );
    }
  }
  // ... rest unchanged
}
```

Beide functies worden opnieuw gedeployed.

