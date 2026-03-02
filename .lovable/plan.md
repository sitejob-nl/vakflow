

## Analyse: Huidige Rompslomp-integratie vs API-mogelijkheden

### Wat er al werkt

| Functie | Status |
|---------|--------|
| Bearer Token authenticatie | ✅ |
| Bedrijf auto-detectie | ✅ |
| Contacten pushen (Vakflow → Rompslomp) | ✅ |
| Facturen pushen (Vakflow → Rompslomp) | ✅ (net gefixt: `lines`, `amount`, `api_reference`) |
| Contacten ophalen (Rompslomp → Vakflow) | ✅ |
| Facturen ophalen (Rompslomp → Vakflow) | ✅ |
| Betaalstatus ophalen | ✅ |
| Test verbinding | ✅ |
| Ontkoppelen | ✅ |
| Webhook voor config-push | ✅ (`rompslomp-config`) |
| Webhook voor events | ✅ (`rompslomp-webhook`) |

### Problemen in huidige code

1. **Contact sync veldnamen fout** — De push naar Rompslomp gebruikt `first_name`, `email`, `phone` maar de API verwacht `contact_person_name` (voor individuen), `contact_person_email_address`, en `contact_number`. Velden `is_individual` en `is_supplier` ontbreken.

2. **Pull contacts veldnamen fout** — Bij het ophalen worden `first_name`/`last_name` gelezen, maar de API retourneert `contact_person_name`, `company_name`, `contact_person_email_address`, `contact_number`, `zipcode`.

3. **Pull invoices: verkeerde bedragvelden** — De code leest `price_without_vat`/`price_with_vat`, maar de API retourneert `total_price_without_vat`/`total_price_with_vat`. Lijn-items hebben `amount` (niet `quantity`).

4. **Pull invoice status: verkeerde veldnaam** — De code checkt `payment_status === "paid"`, maar de API heeft `state` (`concept`/`published`) en `open_amount`. Er is geen `payment_status` veld — betaald = `open_amount === "0.0"`.

5. **Base URL fout** — Code gebruikt `https://api.rompslomp.nl/api/v1` maar de API docs zeggen `https://app.rompslomp.nl/api/v1`.

### Wat er nog ontbreekt (nieuwe mogelijkheden)

| Mogelijkheid | API endpoint | Moeilijkheid |
|-------------|-------------|-------------|
| **Offertes syncen** naar Rompslomp | `POST /quotations` | Medium — quotes tabel bestaat al |
| **Offertes ophalen** uit Rompslomp | `GET /quotations` | Medium |
| **BTW-types ophalen** | `GET /vat_types` — correcte `vat_type_id` meesturen bij factuurregels | Laag |
| **Factuur PDF downloaden** | `GET /sales_invoices/{id}/pdf` | Laag |
| **Betalingen registreren** | `POST /payments` | Laag |
| **Producten syncen** | `GET/POST /products` | Laag |

---

## Plan

### Stap 1: Fix bestaande sync — `sync-rompslomp/index.ts`

**Base URL corrigeren:**
```
https://api.rompslomp.nl/api/v1 → https://app.rompslomp.nl/api/v1
```

**Contact push (sync-contacts) veldnamen fixen:**
```typescript
// Huidig (fout):
{ company_name, first_name, email, phone, address, zipcode, city }

// Correct per API:
{
  is_individual: cust.type === "particulier",
  company_name: cust.type === "zakelijk" ? cust.name : undefined,
  contact_person_name: cust.type === "particulier" ? cust.name : (cust.contact_person || undefined),
  contact_person_email_address: cust.email || undefined,
  contact_number: cust.phone || undefined,
  address: cust.address || undefined,
  zipcode: cust.postal_code || undefined,
  city: cust.city || undefined,
  api_reference: cust.id,  // koppel Vakflow ID als referentie
}
```

**Contact pull (pull-contacts) veldnamen fixen:**
```typescript
// Correct mapping van API response:
name: contact.company_name || contact.contact_person_name || contact.name,
contact_person: contact.contact_person_name || null,
email: contact.contact_person_email_address || null,
phone: contact.contact_number || null,
address: contact.address || null,
postal_code: contact.zipcode || null,
city: contact.city || null,
```

**Invoice pull bedragvelden fixen:**
```typescript
// Correct per API:
subtotal: Number(rInv.total_price_without_vat || 0),
total: Number(rInv.total_price_with_vat || 0),
// Lines: amount i.p.v. quantity
qty: Number(line.amount || 1),
```

**Betaalstatus check fixen:**
```typescript
// Correct: check open_amount in plaats van payment_status
const isPaid = parseFloat(invoiceData.open_amount || "1") === 0;
```

### Stap 2: Offerte-sync toevoegen — `sync-rompslomp/index.ts`

Twee nieuwe acties: `sync-quotes` en `pull-quotes`.

**sync-quotes:** Push Vakflow offertes zonder `rompslomp_id` naar Rompslomp. Mapping:
- `contact_id` → klant's `rompslomp_contact_id`
- `lines` → offerte items met `description`, `amount`, `price_per_unit`
- `api_reference` → offerte nummer
- `date` → `issued_at`

**Vereist:** een `rompslomp_id` kolom op de `quotes` tabel (nieuwe migratie).

### Stap 3: Frontend hooks + UI

- Nieuwe hooks `useSyncQuotesRompslomp` en `usePullQuotesRompslomp` in `useInvoices.ts` (of apart `useQuotesSync.ts`).
- Knoppen toevoegen in SettingsPage bij het Rompslomp blok: "Offertes pushen" en "Offertes ophalen".
- QuotesPage: provider-aware sync knop (zoals InvoicesPage).

### Samenvatting wijzigingen

| Bestand | Wijziging |
|---------|-----------|
| `supabase/functions/sync-rompslomp/index.ts` | Base URL fix, contact veldnamen fix, invoice bedragvelden fix, betaalstatus fix, nieuwe offerte-sync acties |
| DB migratie | `ALTER TABLE quotes ADD COLUMN rompslomp_id text` |
| `src/hooks/useInvoices.ts` | Nieuwe offerte-sync hooks |
| `src/pages/SettingsPage.tsx` | Offerte-sync knoppen toevoegen |
| `src/pages/QuotesPage.tsx` | Provider-aware sync knop |

