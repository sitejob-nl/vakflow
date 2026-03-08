

# Launch Readiness — Kritische Beoordeling

Het platform heeft een solide architectuur maar er zijn **3 kritieke beveiligingsproblemen** die vóór launch opgelost moeten worden, plus enkele verbeterpunten.

---

## Kritiek — Moet gefixt worden vóór launch

### 1. Cross-company privilege escalation via `has_role()` (HOOG RISICO)

De `has_role()` functie controleert of een gebruiker een rol heeft in **ANY** company, niet in de huidige company. Een gebruiker die admin is in bedrijf A maar monteur in bedrijf B, kan admin-operaties uitvoeren in bedrijf B.

**Impact:** Facturen verwijderen, services beheren, contracten wijzigen, user roles aanpassen — allemaal in een bedrijf waar je geen admin bent.

**Fix:** Voeg `_company_id uuid` parameter toe aan `has_role()` en update alle RLS policies.

```sql
-- Van:
has_role(auth.uid(), 'admin')
-- Naar:
has_role(auth.uid(), 'admin', get_my_company_id())
```

### 2. Gevoelige credentials leesbaar voor alle medewerkers (HOOG RISICO)

De `companies` tabel SELECT policy geeft **elke medewerker** toegang tot plaintext SMTP-wachtwoorden, API tokens (Rompslomp, Moneybird, WeFact, e-Boekhouden), OAuth tokens en Stripe IDs.

**Fix:** Beperk de base `companies` SELECT policy tot admins en verwijs niet-admins naar `companies_safe` view.

### 3. SMTP/accounting credentials in profiles tabel leesbaar (MEDIUM RISICO)

Elke collega kan SMTP-wachtwoorden en IBAN-nummers van andere teamleden uitlezen via de `profiles` tabel.

**Fix:** Credential-kolommen verplaatsen naar admin-only tabel, of SELECT policy beperken zodat gevoelige velden alleen zichtbaar zijn voor de eigenaar.

---

## Belangrijk — Sterk aanbevolen vóór launch

### 4. RLS ontbreekt op sommige tabellen
De security scan detecteerde tabellen zonder RLS. Elke publieke tabel zonder RLS is open voor iedereen met de anon key.

### 5. Security Definer Views
Er zijn views met `SECURITY DEFINER` die de permissies van de view-creator gebruiken i.p.v. de querying user. Dit moet gecontroleerd worden.

### 6. Functions zonder `search_path`
Database functions zonder vaste `search_path` zijn kwetsbaar voor search-path injection attacks.

---

## Goed geregeld (positief)

- Multi-tenancy via `company_id` scoping in alle hooks en edge functions
- Tenant mismatch detection bij subdomein-login
- Rate limiting op API endpoints
- API keys gehashed met SHA-256
- Error boundary voor crash recovery
- PWA met offline pagina
- Code splitting en manual chunks
- CORS beperkt tot bekende domeinen
- Edge function error logging
- Cron endpoints beveiligd met `X-Cron-Secret`

---

## Aanbevolen plan van aanpak

| Prioriteit | Taak | Geschatte omvang |
|---|---|---|
| **P0** | Fix `has_role()` + alle RLS policies | Migration + ~30 policies |
| **P0** | Lock `companies` SELECT tot admins | 1 policy wijziging |
| **P0** | Credentials uit `profiles` afschermen | 1 policy of tabel split |
| **P1** | Enable RLS op ontbrekende tabellen | Migration |
| **P1** | Fix `search_path` op functions | Migration |
| **P2** | Security definer views reviewen | Analyse + migration |

Wil je dat ik begin met de P0 fixes? Die zijn essentieel vóór een publieke launch.

