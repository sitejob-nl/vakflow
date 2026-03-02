

## Implementatie Roadmap — Fase 2 Features

Een logische volgorde op basis van afhankelijkheden, gebruikerswaarde, en bouwcomplexiteit.

---

### Fase 2A — Fundament (direct waarde, weinig afhankelijkheden)

| # | Feature | Waarom nu |
|---|---------|-----------|
| 1 | **Tijdregistratie** | Meest gevraagd, standalone, direct bruikbaar voor monteurs. Start/stop timer op werkbon, dagstaten, urenexport. |
| 2 | **Materiaalverbruik registratie** | Kleine database-uitbreiding, koppelt aan bestaande werkbonnen. Producten/materialen tabel + registratie per werkbon. |
| 3 | **Herhaalplanning** | `interval_months` bestaat al op klanten. Automatisch afspraken genereren op basis van interval. Laaghangend fruit. |
| 4 | **Rapportages** | Bouwt voort op tijdregistratie + materiaalverbruik. KPI-dashboard met omzet, productiviteit, doorlooptijd. |

### Fase 2B — Objectbeheer (bouwt op elkaar)

| # | Feature | Waarom nu |
|---|---------|-----------|
| 5 | **Objectbeheer / Assetmanagement** | Nieuw datamodel (objecten tabel). Koppeling aan klanten, locatie, onderhoudshistorie. Basis voor veel volgende features. |
| 6 | **Objecten vanuit veldapp aanmaken** | Uitbreiding op #5, mobiele registratie. |
| 7 | **Scan objecten in het veld** | QR/barcode scanner, koppelt aan objecten uit #5. |
| 8 | **Automatische planning van objecten** | Objecten + herhaalplanning (#3) combineren: automatisch inplannen op basis van onderhoudsinterval. |
| 9 | **Object specifieke formulieren** | Vereist eerst eigen formulieren (#10). |

### Fase 2C — Formulieren & Veiligheid

| # | Feature | Waarom nu |
|---|---------|-----------|
| 10 | **Eigen formulieren** | Formulierbouwer: custom velden, drag & drop, koppeling aan diensten. Basis voor VCA en object-formulieren. |
| 11 | **VCA Checks en Veiligheidsformulieren** | Voorgedefinieerde templates op de formulierbouwer uit #10. Verplichte checks vóór werkstart. |
| 12 | **Formulieren automatisch toevoegen aan werkbontypes** | Koppeltabel formulier ↔ diensttype, automatisch laden bij werkbon. |

### Fase 2D — Personeel & Planning

| # | Feature | Waarom nu |
|---|---------|-----------|
| 13 | **Vaardigheden gebruikers** | Skills/certificaten per monteur, verloopdatums. |
| 14 | **Personeelsplanning** | Beschikbaarheid, verlof, capaciteitsoverzicht. Bouwt voort op bestaand planbord. |
| 15 | **Ad-hoc planningen** | Spoedopdrachten met prioriteit in bestaande planning. |

### Fase 2E — Dagstaten & Kennisbank

| # | Feature | Waarom nu |
|---|---------|-----------|
| 16 | **Dagstaten invullen in het veld** | Combineert tijdregistratie (#1) + materiaalverbruik (#2) in dagelijks overzicht. |
| 17 | **Mutatie ingevulde dagstaten** | Correcties/goedkeuring workflow op #16. |
| 18 | **Informatiebeheer** | Kennisbank/documenten per klant of object. Laatste prioriteit, meest standalone. |

---

### Visueel pad

```text
Fase 2A (fundament)          Fase 2B (objecten)         Fase 2C (formulieren)
─────────────────────        ──────────────────         ─────────────────────
1. Tijdregistratie ──┐       5. Objectbeheer ──┐        10. Eigen formulieren ──┐
2. Materiaalverbruik ├─→ 4   6. Veldapp aanmak │            │                   │
3. Herhaalplanning ──┘       7. QR Scanner     ├─→ 8    11. VCA Checks          │
4. Rapportages               9. Object forms ──┘←──────12. Auto-koppeling ──────┘

Fase 2D (personeel)          Fase 2E (afronding)
──────────────────           ───────────────────
13. Vaardigheden             16. Dagstaten ←── 1 + 2
14. Personeelsplanning       17. Mutatie dagstaten
15. Ad-hoc planningen        18. Informatiebeheer
```

### Aanbevolen startvolgorde

Begin met **Tijdregistratie** — het is de meest gevraagde feature, volledig standalone, en levert direct waarde op voor monteurs en planners. Daarna **Materiaalverbruik** en **Herhaalplanning** als snelle wins voordat het grotere objectbeheer-blok wordt aangepakt.

