

## Probleem: Klanten importeren mislukt

### Oorzaak

De import-functie in `CustomersPage.tsx` (regel 141) voegt klanten in **zonder `company_id`** mee te geven:

```typescript
const { error } = await supabase.from("customers").insert(batch);
```

De `batch` bevat alleen: `name`, `phone`, `email`, `address`, `postal_code`, `city`, `notes`, `type` — maar geen `company_id`.

De RLS-policy op de `customers` tabel vereist dat `company_id = get_my_company_id()`, waardoor de insert wordt geweigerd met een "new row violates row-level security policy" fout.

Ter vergelijking: de `useCreateCustomer` hook in `useCustomers.ts` voegt wel `company_id: companyId` toe bij elke insert.

### Oplossing

**1 bestand aanpassen: `src/pages/CustomersPage.tsx`**

- Bij het opbouwen van de `mapped` array (regel 114-124): `company_id` toevoegen aan elk object, uit de `useAuth()` context
- De `companyId` is al beschikbaar via `useAuth` (wordt al geïmporteerd in het bestand)

Concreet: in de `map` callback toevoegen: `company_id: companyId`

