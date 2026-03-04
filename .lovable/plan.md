

## Offerte Template Builder met Drag & Drop

### Wat wordt gebouwd

De huidige `TemplateDialog` (simpele lijst van artikelen) wordt vervangen door een blok-gebaseerde builder, vergelijkbaar met de e-mail builder. Gebruikers kunnen secties toevoegen, verslepen en binnen secties items herordenen.

### Bloktypen

| Blok | Beschrijving |
|---|---|
| **Artikelgroep** | Groep regelitems (omschrijving, aantal, prijs) — items binnen de groep zijn ook versleepbaar |
| **Koptekst** | Sectietitel (bijv. "Materialen", "Arbeid") |
| **Vrije tekst** | Vrij tekstveld voor toelichting/voorwaarden |
| **Scheidingslijn** | Visuele scheiding |
| **Optionele items** | Groep optionele meerprijs-items |

### Database

Geen schema-wijzigingen nodig. De `quote_templates` tabel slaat `items` en `optional_items` al op als JSONB. We voegen een nieuw `blocks` JSONB-veld toe aan de tabel zodat de blokstructuur bewaard blijft, met fallback naar de huidige items-structuur voor bestaande templates.

### Technische aanpak

**1. Database migratie** — `blocks` kolom toevoegen aan `quote_templates` (JSONB, nullable, default `null`)

**2. Nieuw component: `src/components/QuoteTemplateBuilder.tsx`**
- Blok-gebaseerde UI geïnspireerd op `EmailTemplateEditor.tsx`
- Native HTML5 drag & drop (geen extra dependency) voor blokken EN items binnen blokken
- Elke blok heeft toolbar: grip handle, type-label, omhoog/omlaag, verwijderen
- "Blok toevoegen" knoppen onderaan
- Bij opslaan: blokken → `blocks` JSONB + afgeleide `items`/`optional_items` arrays (voor backward compatibility met QuoteDialog en PDF-generatie)

**3. `TemplateDialog` updaten**
- Builder-component integreren in plaats van de huidige platte lijsten
- Bij laden: als `blocks` bestaat → builder-modus; anders → blokken afleiden uit bestaande `items`/`optional_items`

**4. `useQuoteTemplates.ts` updaten**
- `blocks` veld toevoegen aan types en mutations

### Bestanden

| Bestand | Actie |
|---|---|
| `supabase/migrations/add_blocks_to_quote_templates.sql` | Nieuwe kolom |
| `src/components/QuoteTemplateBuilder.tsx` | **Nieuw** — builder component |
| `src/components/TemplateDialog.tsx` | Integreer builder |
| `src/hooks/useQuoteTemplates.ts` | `blocks` veld in types/mutations |

