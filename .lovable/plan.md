

## Agenda UI Verbetering — Look & Feel + Leesbaarheid

### Problemen

1. **Events te klein / moeilijk leesbaar** — `SLOT_HEIGHT` is 20px (kwartier), events zijn erg krap met tekst op 9-10px
2. **Algehele look & feel** — toolbar ziet er functioneel maar niet gepolijst uit, het grid mist visuele hiërarchie, events missen diepte

### Aanpak

**1. Grotere tijdslots en events**
- `SLOT_HEIGHT` verhogen van 20px naar 28px — events worden 40% groter
- Event tekst vergroten: klantnaam naar 11-12px, tijdstip naar 10px
- Meer ruimte voor service-naam en stad onder de klantnaam

**2. Event cards verbeteren**
- Subtielere achtergrondkleur met betere contrast
- Lichte shadow toevoegen aan events voor diepte
- Rounded corners vergroten, padding verruimen
- Status-indicatie (kleurig bolletje) toevoegen aan event cards in het grid
- Hover-effect verbeteren met schaal + shadow

**3. Toolbar opschonen (desktop)**
- Knoppen groeperen met visuele scheiders
- "Nieuwe afspraak" knop prominenter maken (groter, duidelijker icon)
- Navigatie-pijlen verbeteren (echte icon-buttons i.p.v. tekst ‹ ›)
- Badge voor aantal afspraken subtieler

**4. Dagkolom headers verbeteren (desktop weekview)**
- Datum groter en duidelijker, weekdag + dagnummer gescheiden
- Vandaag-indicator prominenter met filled cirkel rond dagnummer (zoals Google Calendar)

**5. Zijpaneel styling**
- Subtielere card-styling, betere spacing
- Status-dots vergroten in de afsprakenlijst
- Betere typografie-hiërarchie

**6. Mobile day view**
- Zelfde slot-hoogte verbetering
- Events met meer padding en grotere tekst

### Bestanden

| Bestand | Wijziging |
|---|---|
| `src/pages/PlanningPage.tsx` | SLOT_HEIGHT, event rendering, toolbar, kolom headers |
| `src/components/planning/CurrentTimeIndicator.tsx` | Mogelijk aanpassen aan nieuwe slot hoogte |

Geen database-wijzigingen, geen nieuwe dependencies.

