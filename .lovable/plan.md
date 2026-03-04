

## Analyse: SMTP ondersteuning

### Huidige situatie

**Uitgaand (SMTP - `send-email`):**
- Host en port zijn **configureerbaar** via `smtp_host` en `smtp_port` in de database
- Maar de **fallback** is hardcoded naar TransIP: `smtp.transip.email:465`
- Dit werkt dus al voor andere providers, mits de gebruiker host/port invult

**Inkomend (IMAP - `fetch-emails`):**
- IMAP is **hardcoded** naar `imap.transip.email:993` (regel 422-428)
- Er wordt geen `imap_host` of `imap_port` uit de database gelezen
- Dit werkt dus **alleen met TransIP**

### Wat moet er veranderen

**1. Database: IMAP-velden toevoegen aan `companies`**
- `imap_host` (text, nullable, default `null`)
- `imap_port` (integer, nullable, default `null`)

**2. `fetch-emails/index.ts` aanpassen**
- IMAP host/port lezen uit `companies` tabel (naast `smtp_email`/`smtp_password`)
- Fallback naar `imap.transip.email:993` als niet ingesteld
- Company query uitbreiden met `imap_host, imap_port`

**3. Instellingen UI (`SettingsPage.tsx` — E-mail tab)**
- Velden toevoegen voor IMAP host en IMAP port
- Opslaan via `save-smtp-credentials` edge function

**4. `save-smtp-credentials/index.ts` aanpassen**
- `imap_host` en `imap_port` accepteren en opslaan

### Samenvatting

| | Uitgaand (SMTP) | Inkomend (IMAP) |
|---|---|---|
| **Nu** | Configureerbaar (fallback TransIP) | Alleen TransIP (hardcoded) |
| **Na fix** | Configureerbaar (fallback TransIP) | Configureerbaar (fallback TransIP) |

