

## Overzicht boekhoudintegraties in Vakflow

### Huidige integraties (3 stuks)

| Provider | Edge Function | Configuratie-opslag | Status |
|---|---|---|---|
| **Rompslomp** | `sync-rompslomp` (716 regels) | `companies.rompslomp_api_token`, `rompslomp_company_id`, `rompslomp_tenant_id` | Volledig |
| **Moneybird** | `sync-moneybird` (756 regels) | `companies.moneybird_api_token`, `moneybird_administration_id` | Volledig |
| **e-Boekhouden** | `sync-invoice-eboekhouden` (932 regels) | `profiles.eboekhouden_api_token` (versleuteld), template/ledger IDs op profiles | Werkend maar afwijkend |

---

### Wat elke integratie KAN

| Functionaliteit | Rompslomp | Moneybird | e-Boekhouden |
|---|---|---|---|
| Auto-detect (bedrijven/administraties) | ✅ | ✅ | ❌ |
| Verbinding testen | ✅ | ✅ | ✅ |
| Contacten pushen | ✅ | ✅ | ✅ |
| Contacten pullen | ✅ | ✅ | ✅ (via auto-sync) |
| Facturen pushen (bulk) | ✅ | ✅ | ✅ (via auto-sync) |
| Factuur aanmaken (enkel, bij creatie) | ✅ `create-invoice` | ✅ `create-invoice` | ❌ |
| Facturen pullen | ✅ | ✅ | ✅ (via auto-sync) |
| Betaalstatus pullen | ✅ | ✅ | ✅ (via auto-sync) |
| Offertes pushen | ✅ `sync-quotes` | ✅ `sync-quotes` + `create-quote` | ✅ `sync-quote` |
| Offertes pullen | ✅ | ✅ | ❌ |
| PDF downloaden | ✅ | ✅ | ❌ |
| Offerte aanmaken (enkel, bij creatie) | ❌ | ✅ `create-quote` | ❌ |
| Factuurnummer overnemen | ✅ | ✅ | ❌ |

---

### Wat verbeterd/aangepast moet worden

#### 1. e-Boekhouden configuratie zit op `profiles` i.p.v. `companies` (architectuur-inconsistentie)

Rompslomp en Moneybird slaan tokens op in de `companies` tabel (bedrijfsniveau). e-Boekhouden slaat alles op in `profiles` (gebruikersniveau): `eboekhouden_api_token`, `eboekhouden_template_id`, `eboekhouden_ledger_id`, `eboekhouden_debtor_ledger_id`. Dit betekent:
- Elke gebruiker moet apart configureren
- Bij verwijderen van een gebruiker gaat de koppeling verloren
- De edge function itereert over alle profielen i.p.v. over bedrijven

**Oplossing:** Migreer e-Boekhouden config naar de `companies` tabel (net als Rompslomp/Moneybird). Voeg kolommen toe: `eboekhouden_api_token` op companies, verplaats template/ledger IDs.

#### 2. e-Boekhouden mist `create-invoice` actie (geen auto-sync bij aanmaken)

Bij Rompslomp en Moneybird wordt een factuur direct bij aanmaken gepusht via `create-invoice`. Bij e-Boekhouden gebeurt dit niet — facturen worden pas gesynchroniseerd bij de volgende `auto-sync` run. Hetzelfde geldt voor offertes.

**Oplossing:** Voeg een `create-invoice` actie toe aan `sync-invoice-eboekhouden` en integreer deze in `InvoiceDialog.tsx` (waar nu alleen Rompslomp/Moneybird worden afgehandeld).

#### 3. Rompslomp mist `create-quote` actie (geen auto-sync bij offerte aanmaken)

Moneybird heeft een `create-quote` actie die een offerte direct pusht bij aanmaken. Rompslomp heeft dit niet — offertes worden alleen via de bulk `sync-quotes` gesynchroniseerd.

**Oplossing:** Voeg een `create-quote` actie toe aan `sync-rompslomp` en koppel deze in `QuoteDialog.tsx`.

#### 4. Geen uniforme "create" flow in QuoteDialog/InvoiceDialog voor e-Boekhouden

`InvoiceDialog.tsx` en `QuoteDialog.tsx` controleren alleen op `accountingProvider === "rompslomp" || accountingProvider === "moneybird"`. e-Boekhouden wordt volledig genegeerd bij het aanmaken van facturen/offertes.

**Oplossing:** Breid de auto-sync logica in beide dialogen uit met een `eboekhouden` case.

#### 5. e-Boekhouden mist auto-detect flow

Rompslomp en Moneybird hebben een `auto-detect` actie waarmee na het invoeren van een token automatisch bedrijven/administraties worden opgehaald. e-Boekhouden mist dit — de gebruiker moet handmatig template- en ledger-IDs configureren (wat al geïmplementeerd is via dropdowns, maar het token-validatie stap is handmatiger).

#### 6. PDF download niet beschikbaar voor e-Boekhouden

Rompslomp en Moneybird bieden PDF-download van facturen. e-Boekhouden niet. Dit kan een API-beperking zijn, maar zou onderzocht moeten worden.

#### 7. Betaalstatus-sync is niet geautomatiseerd

Voor alle drie de providers bestaat een `pull-invoice-status` actie, maar deze wordt alleen handmatig getriggerd (er is geen cron/scheduled job). Betaalstatussen worden dus niet automatisch bijgewerkt.

**Oplossing:** Voeg een Supabase cron job toe die periodiek (bijv. dagelijks) de betaalstatus van alle onbetaalde facturen ophaalt.

#### 8. Bulk sync-knoppen ontbreken in de UI voor Rompslomp/Moneybird

De SettingsPage heeft test/configuratie-knoppen, maar geen duidelijke "Synchroniseer nu" knoppen voor bulk contact/factuur/offerte sync. De bulk sync acties (`sync-contacts`, `sync-invoices`, `pull-contacts`, `pull-invoices`) zijn alleen via de edge function beschikbaar.

---

### Aanbevolen prioriteit

1. **e-Boekhouden `create-invoice` + `create-quote`** — Zodat facturen/offertes direct worden gesynchroniseerd bij aanmaken, consistent met Rompslomp/Moneybird
2. **Rompslomp `create-quote`** — Offerte direct pushen bij aanmaken
3. **InvoiceDialog/QuoteDialog uitbreiden** — e-Boekhouden toevoegen aan de auto-sync flow
4. **e-Boekhouden config migreren naar companies** — Architectuurconsistentie
5. **Automatische betaalstatus-sync** — Cron job voor alle providers
6. **Bulk sync UI** — Knoppen in SettingsPage voor handmatige sync

