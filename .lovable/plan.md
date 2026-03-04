

## Plan: SnelStart Subscription Key als Supabase Secret

### Probleem

De **subscription key** (ontwikkelsleutel) is een app-niveau sleutel die Vakflow als ontwikkelaar ontvangt van het SnelStart Developer Portal. Deze is voor alle tenants hetzelfde. Nu wordt deze per tenant opgeslagen in `snelstart_connections`, wat onnodig en onveilig is.

Alleen de **koppelingssleutel** (client_key) is per tenant verschillend -- die beheert de eindgebruiker via SnelStart Web.

### Wijzigingen

**1. Supabase Secret toevoegen**
- `SNELSTART_SUBSCRIPTION_KEY` als Supabase secret opslaan (via add_secret tool)

**2. `_shared/snelstart-client.ts` aanpassen**
- `subscription_key` uit `Deno.env.get("SNELSTART_SUBSCRIPTION_KEY")` halen in plaats van uit de connection record
- `SnelstartConnection` interface: `subscription_key` veld verwijderen

**3. Settings UI vereenvoudigen**
- Het invoerveld "Subscription key" verwijderen uit de SnelStart-koppelingskaart
- Gebruiker hoeft alleen de koppelingssleutel in te voeren
- `useSaveSnelstartConnection` hook aanpassen: geen subscription_key meer meesturen

**4. Database opschonen**
- `subscription_key` kolom kan in de toekomst verwijderd worden uit `snelstart_connections`, maar voor nu maken we het optioneel (geen breaking migration nodig)

### Bestanden

| Bestand | Wijziging |
|---------|-----------|
| `supabase/functions/_shared/snelstart-client.ts` | Subscription key uit env halen |
| `src/pages/SettingsPage.tsx` | Subscription key invoerveld verwijderen |
| `src/hooks/useSnelstart.ts` | subscription_key uit save logica verwijderen |

