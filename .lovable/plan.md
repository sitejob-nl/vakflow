

## Plan: Rompslomp Company ID automatisch ophalen

### Huidige situatie
De gebruiker moet handmatig zowel een API token als een Company ID invullen. De Rompslomp API biedt `GET /api/v1/me` en `GET /api/v1/companies` endpoints waarmee het company_id automatisch opgehaald kan worden.

### Wijzigingen

**1. `supabase/functions/sync-rompslomp/index.ts` — nieuwe actie `auto-detect`**
- Nieuwe actie die het API token uit de request body ontvangt (nog niet opgeslagen)
- Roept `GET /api/v1/companies` aan met het token
- Geeft lijst van companies terug (id + naam)
- Wordt aangeroepen voordat de koppeling wordt opgeslagen

**2. `src/pages/SettingsPage.tsx` — Koppelingen tab**
- Na invoeren van API token: knop "Detecteer bedrijf" die `sync-rompslomp` met `action: "auto-detect"` aanroept
- Bij 1 bedrijf: vult automatisch Company ID en naam in
- Bij meerdere: laat een select zien om te kiezen
- Company ID veld wordt dan read-only (automatisch ingevuld)
- Verwijder de handmatige Company ID input of maak het optioneel als fallback

