

# Werkplaatsafspraak optimalisatie (Automotive)

## Problemen

1. **Geen "wordt gebracht / ophalen" keuze** -- Bij een werkplaatsafspraak ontbreekt de optie of de klant de auto brengt of dat deze opgehaald moet worden
2. **Geen ophaallocatie** -- Als ophalen geselecteerd is, is er geen veld voor het ophaaladres
3. **Startlocatie niet gevuld met bedrijfsadres** -- De fallback is hardcoded "Heemskerk (standaard)" i.p.v. het bedrijfsadres uit de `companies` tabel
4. **Formulier te lang** -- Alle velden worden tegelijk getoond, ook als ze niet relevant zijn

## Technisch plan

### 1. Database: nieuwe kolommen op `appointments`

```sql
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS delivery_type text DEFAULT 'gebracht';
-- 'gebracht' = klant brengt auto, 'ophalen' = auto moet opgehaald worden
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS pickup_address text;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS pickup_lat numeric;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS pickup_lng numeric;
```

### 2. Startlocatie: bedrijfsadres als default (AppointmentDialog.tsx)

Huidige code haalt de startlocatie uit `profiles.location` (persoonlijk profiel). Als die leeg is, valt het terug op hardcoded `[52.507, 4.678]` "Heemskerk".

**Fix:** Na het profile-check, ook het bedrijfsadres ophalen uit `companies_safe` (address, city, postal_code) en dat als fallback gebruiken i.p.v. de hardcoded waarden. Het bedrijfsadres heeft al `address`, `city`, `postal_code` kolommen.

### 3. Formulier inkorten met secties (AppointmentDialog.tsx)

Voor automotive: het formulier opsplitsen in compacte secties met `Collapsible` of conditional rendering:

- **Hoofdvelden** (altijd zichtbaar): Klant, Voertuig, Datum/tijd, Duur
- **Werkplaats-specifiek** (automotive, conditionally): Wordt gebracht/Ophalen toggle, ophaaladres (alleen als "ophalen"), werkplaatsbrug
- **Routeinfo** (inklapbaar): Startlocatie, reistijd -- standaard ingeklapt bij werkplaats (want auto wordt gebracht)
- **Overig** (altijd zichtbaar): Status, Notities

### 4. Automotive workshop flow (AppointmentDialog.tsx)

Wanneer `isAutomotive`:
- Toon `delivery_type` radio/toggle: "Wordt gebracht" | "Ophalen"
- Als "Ophalen": toon `AddressAutocomplete` voor ophaaladres (met geocoding)
- Als "Wordt gebracht": verberg startlocatie/reistijd secties (niet relevant)
- Startlocatie sectie alleen tonen bij "Ophalen" (dan is het relevant voor routeberekening)

### 5. Payload & opslag

In `handleSubmit`: `delivery_type`, `pickup_address`, `pickup_lat`, `pickup_lng` meesturen. Bij "ophalen" de pickup-coördinaten gebruiken als bestemming voor reistijdberekening i.p.v. het klantadres.

### Samenvatting wijzigingen

| Bestand | Wijziging |
|---|---|
| Migration SQL | 4 kolommen op `appointments` |
| `src/integrations/supabase/types.ts` | Types bijwerken |
| `src/components/AppointmentDialog.tsx` | Bedrijfsadres als default, delivery_type toggle, ophaaladres, formulier compacter maken |

Geen nieuwe bestanden nodig. Geen edge function wijzigingen.

