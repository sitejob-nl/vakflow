

# Fix: Auto-resolve customer_id bij WhatsApp versturen

## Huidige situatie
- RLS op `whatsapp_messages` dwingt `company_id` isolatie af -- berichten zijn al veilig per bedrijf
- Probleem: als `customer_id` niet wordt meegegeven, wordt het bericht opgeslagen zonder koppeling en is het onzichtbaar in de chat UI

## Oplossing

### `supabase/functions/whatsapp-send/index.ts`

Na het succesvol versturen via Meta, voor de database-insert: als `customer_id` ontbreekt, zoek de klant op basis van telefoonnummer binnen hetzelfde bedrijf. Gebruik de bestaande `findCustomerByPhone` functie uit `_shared/phone.ts` die al meerdere telefoonformaten probeert (internationaal, +prefix, 06-formaat).

```typescript
// Bestaande code:
const { to, customer_id, type = "text" } = body;
const normalizedTo = normalizePhone(to);

// Toevoegen na Meta API call, voor de insert:
let resolvedCustomerId = customer_id || null;
if (!resolvedCustomerId && companyId) {
  const found = await findCustomerByPhone(supabaseAdmin, normalizedTo, companyId);
  if (found) resolvedCustomerId = found.id;
}

// In de insert: customer_id: resolvedCustomerId (ipv customer_id || null)
```

### Veiligheid
- `findCustomerByPhone` wordt aangeroepen met `companyId` -- zoekt alleen binnen het eigen bedrijf
- RLS op `whatsapp_messages` voorkomt cross-tenant reads
- De edge function haalt `companyId` uit de authenticated user's profile

| Bestand | Wijziging |
|---------|-----------|
| `supabase/functions/whatsapp-send/index.ts` | Import `findCustomerByPhone`, auto-resolve `customer_id` voor insert |

