

## Plan: RDW Lookup upgraden naar v3 API + correcte velden

### Problemen met huidige implementatie

1. **Verouderde API URL** — gebruikt `/resource/m9d7-ebf2.json` (SODA v2), moet naar v3: `https://opendata.rdw.nl/api/v3/views/m9d7-ebf2/query.json`
2. **`brandstof_omschrijving` bestaat niet** in de hoofdtabel — brandstofgegevens zitten in een apart linked dataset. We moeten de brandstof-API apart aanroepen via `api_gekentekende_voertuigen_brandstof` link.
3. **APK vervaldatum** zit wél direct in de hoofdtabel als `vervaldatum_apk` (number YYYYMMDD) en `vervaldatum_apk_dt` (timestamp) — de aparte call naar `3huj-srit` is overbodig.
4. **Extra bruikbare velden** beschikbaar: `voertuigsoort`, `inrichting`, `aantal_deuren`, `catalogusprijs`, `type`, `europese_voertuigcategorie`, `tellerstandoordeel`

### Wijzigingen

**Bestand: `supabase/functions/rdw-lookup/index.ts`**

- Update hoofdendpoint naar v3 API met SoQL filter: `https://opendata.rdw.nl/api/v3/views/m9d7-ebf2/query.json?$$query=SELECT * WHERE kenteken='${normalized}'`
- Haal `vervaldatum_apk` direct uit de hoofdresponse (verwijder aparte APK call)
- Voeg brandstof-lookup toe via het linked brandstof-endpoint: `https://opendata.rdw.nl/resource/8ys7-d773.json?kenteken=${normalized}` (Gekentekende_voertuigen_brandstof)
- Voeg extra velden toe aan response: `vehicle_type`, `body_type`, `num_doors`, `catalog_price`, `europese_voertuigcategorie`
- Parse `vervaldatum_apk_dt` als ISO date als beschikbaar, fallback naar number-veld

