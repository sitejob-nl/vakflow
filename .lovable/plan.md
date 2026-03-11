

# WhatsApp Instellingen — UI Uitbreiding

## Analyse

Vakflow's WhatsApp **backend** is al uitgebreider dan de referentie (multi-tenant, alle berichttypen, rate limiting, error mapping, typing indicator). De referentie biedt echter een veel rijkere **instellingen-UI** (1248 regels vs. Vakflow's 177 regels).

## Wat Vakflow al heeft (backend)

| Feature | Backend | UI |
|---------|---------|-----|
| Business profiel get/update/upload foto | ✓ | Deels (geen foto, geen vertical, geen websites) |
| Template ophalen | ✓ | ✓ (read-only lijst) |
| Template create/delete | ✓ | ✗ |
| Disconnect | ✓ | ✗ |
| Mark as read / Typing | ✓ | ✓ (in chat) |

## Wat ontbreekt

### 1. Phone quality check (nieuw backend endpoint)
Vakflow mist een `quality_rating` / `verified_name` / `code_verification_status` endpoint. Toevoegen als nieuwe actie `"phone_quality"` in `whatsapp-send/index.ts`.

### 2. Rijkere SettingsWhatsAppTab (UI upgrade)
De huidige tab is minimaal. Uitbreiden met:
- **Telefoonkwaliteit badge** — quality_rating (GREEN/YELLOW/RED), verified_name, verificatiestatus
- **Berichtenstatistieken** — verstuurd/ontvangen/afgeleverd/gelezen met Recharts grafiek per dag (periode-selector: 7/14/30 dagen)
- **Template management** — toevoegen van create en delete knoppen (backend bestaat al in `whatsapp-templates`)
- **Volledig profiel** — vertical-selectie, websites beheer, profielfoto uploaden (backend bestaat al in `whatsapp-business-profile`)
- **Ontkoppelen** — disconnect knop met bevestigingsdialoog

## Implementatieplan

### Stap 1: Phone quality actie toevoegen aan `whatsapp-send/index.ts`
Nieuwe `action: "phone_quality"` die `quality_rating`, `verified_name`, `code_verification_status`, `display_phone_number` ophaalt via Meta Graph API.

### Stap 2: `SettingsWhatsAppTab.tsx` herschrijven
Uitbreiden van 177 → ~600 regels met alle bovengenoemde features. Blijft Vakflow's design-systeem en hooks-patroon gebruiken (useQuery/useMutation via bestaande hooks + nieuwe inline fetches).

## Bestanden

| Bestand | Actie |
|---------|-------|
| `supabase/functions/whatsapp-send/index.ts` | Toevoegen `phone_quality` actie (~15 regels) |
| `src/components/settings/SettingsWhatsAppTab.tsx` | Herschrijven met uitgebreide UI |

Geen database-wijzigingen nodig.

