

## Verbeterpunten voor de Agenda/Planning

Na analyse van de huidige code zijn er diverse verbetermogelijkheden. Hier een overzicht:

### Wat er al goed werkt
- Weekweergave (desktop) en dagweergave (mobile)
- Reistijdberekening met Mapbox
- Overlapdetectie bij inplannen
- To-do's en notities per afspraak
- Automatische werkbon-aanmaak bij afronden
- Dagomzet-overzicht in het zijpaneel

### Mogelijke verbeteringen

**1. Drag & drop afspraken verplaatsen**
Events in de weekkalender verslepen naar een ander tijdslot of dag. Scheelt veel klikken bij herplannen.

**2. Medewerkerfilter / kolommen per medewerker**
Nu zie je alle afspraken door elkaar. Een filter of aparte kolom per monteur maakt het overzichtelijker voor bedrijven met meerdere medewerkers.

**3. Maandweergave**
Naast week- en dagweergave een maandoverzicht toevoegen met stippen/kleuren per dag zodat je snel kunt zien welke dagen vol zitten.

**4. Terugkerende afspraken**
Mogelijkheid om een herhaalpatroon in te stellen (elke X weken/maanden) -- sluit aan bij de onderhoudsplanner.

**5. Adres-selectie in afspraakdialog**
De klant kan meerdere adressen hebben (via de `addresses` tabel). Een selector toevoegen zodat je het specifieke werkadres kiest bij inplannen.

**6. Slepen om duur aan te passen**
Onderrand van een event slepen om de duur te verlengen/verkorten.

**7. "Vandaag" indicator-lijn**
Een rode horizontale lijn op het huidige tijdstip in de kalender, zodat je direct ziet hoe laat het is.

**8. Snelkoppeling "kopieer afspraak"**
Een "dupliceer" knop in de detail-sheet, zodat je snel dezelfde afspraak voor een andere datum kunt aanmaken.

### Aanbevolen volgorde

| Prioriteit | Verbetering | Complexiteit |
|---|---|---|
| 1 | Huidige-tijd indicator | Laag |
| 2 | Medewerkerfilter | Middel |
| 3 | Maandweergave | Middel |
| 4 | Adres-selectie bij afspraak | Laag |
| 5 | Kopieer afspraak | Laag |
| 6 | Drag & drop verplaatsen | Hoog |
| 7 | Terugkerende afspraken | Hoog |

