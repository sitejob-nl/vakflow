

## Vakflow Feature Analyse: Wat hebben we vs. wat ontbreekt

### ✅ Al gebouwd

| Feature | Implementatie |
|---------|--------------|
| **Field service app** | Volledige PWA met offline support (`vite-plugin-pwa`) |
| **Digitale werkbonnen** | `WorkOrdersPage`, `WorkOrderDetailPage`, checklist, foto's, handtekening |
| **Digitaal planbord** | `PlanningPage` met weekweergave, kwartierslots, drag-achtige UI |
| **Integraties met boekhoudpakket** | e-Boekhouden, Rompslomp, Moneybird — alle drie volledig |
| **On- en offline werken** | PWA met service worker, pull-to-refresh |
| **Realtime communicatie** | WhatsApp Business API integratie, templates, automations |
| **Werkbon app** | Mobiele werkbon flow met checklist, foto's voor/na, notities |
| **Realtime updates** | Supabase realtime subscriptions op appointments |
| **Historie** | Communicatielogs, werkbon notities met timestamps |
| **Klantcommunicatie** | WhatsApp, e-mail (SMTP + Outlook), communicatielogs |
| **SMS / E-mail functie** | E-mail via SMTP/Outlook, WhatsApp (geen SMS) |
| **Automatisering** | WhatsApp automations met triggers, cooldowns, variabelen |
| **Personaliseren** | Bedrijfslogo, merkkleur, diensten met kleuren |
| **Werkbon planning** | Afspraken → werkbonnen koppeling |
| **Werkplanning** | Weekplanner met reistijdberekening (Mapbox) |
| **Werkorder** | Volledige CRUD met statussen (open/bezig/afgerond) |
| **Online werkbon** | PDF generatie, digitale handtekening |
| **Field service planning** | Planning met toewijzing aan monteurs |
| **Buitendienst planning** | Planbord met routeberekening |
| **Werkbonnen toewijzen aan specifieke gebruikers** | `assigned_to` op appointments |
| **Gratis werkbon voorbeeld & template** | Diensten met checklist templates |

### ❌ Nog niet gebouwd

| Feature | Wat het inhoudt |
|---------|----------------|
| **Tijdregistratie** | Urenregistratie per werkbon/monteur, start/stop timer, dagstaten |
| **Objectbeheer / Assetmanagement** | Assets/objecten registreren met locatie, onderhoudshistorie, QR/barcode |
| **Eigen formulieren** | Formulierbouwer voor custom velden per werkbontype |
| **VCA Checks en Veiligheidsformulieren** | Veiligheidschecklist templates, verplichte checks vóór werkstart |
| **Registreer materiaalverbruik** | Materialen/voorraad koppelen aan werkbonnen |
| **Rapportages** | Dashboard met KPI's, omzet, productiviteit, export |
| **Informatiebeheer** | Kennisbank/documenten per klant of object |
| **Vaardigheden gebruikers** | Skills/certificaten per monteur, automatische matching |
| **Personeelsplanning** | Beschikbaarheid, verlof, capaciteitsoverzicht |
| **Ad-hoc planningen** | Spoedopdrachten met prioriteit in bestaande planning |
| **Herhaalplanning** | Terugkerende afspraken op interval (al deels: `interval_months` op klanten) |
| **Scan objecten in het veld** | QR/barcode scanner in de app |
| **Automatische planning van objecten** | Op basis van interval automatisch inplannen |
| **Object specifieke formulieren** | Formulieren gekoppeld aan objecttype |
| **Objecten vanuit veldapp aanmaken** | Asset registratie vanuit mobiel |
| **Dagstaten invullen in het veld** | Dag-overzicht met uren, materiaal, ritten |
| **Mutatie ingevulde dagstaten** | Correcties op ingediende dagstaten |
| **Urenregistratie app voor monteurs en planners** | Timer + handmatige invoer |
| **Formulieren automatisch toevoegen aan werkbontypes** | Koppeling formulier ↔ diensttype |

### Samenvatting

**Gebouwd: ~21 van 30+ functies** — de kern (werkbonnen, planning, boekhoudkoppelingen, communicatie, PWA) staat stevig.

**Grootste gaps:** Tijdregistratie, objectbeheer/assetmanagement, eigen formulieren, materiaalverbruik, rapportages, en VCA/veiligheidsformulieren. Dit zijn typische "fase 2" field service features die de app naar enterprise-niveau tillen.

