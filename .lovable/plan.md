

## Probleem

Er zijn meerdere tekortkomingen in de huidige e-mail module:

1. **Verzender altijd "Onbekend"**: Inkomende mails zonder gekoppelde klant tonen "Onbekend" omdat er geen `sender_email`/`sender_name` kolommen bestaan. Het verzenderadres wordt nu in het subject gestopt als `[van: ...]`.
2. **HTML wordt niet gerenderd**: De body bevat raw HTML maar wordt als platte tekst getoond met `whitespace-pre-wrap`.
3. **Compose: geen losse e-mailadressen**: Je kunt alleen klanten selecteren, niet een willekeurig e-mailadres invullen.
4. **Geen mailbox-mappen**: Graph API ondersteunt mailbox folders maar die worden niet opgehaald/getoond.

---

## Oplossing

### 1. Database: sender kolommen toevoegen

Migratie op `communication_logs`:
```sql
ALTER TABLE communication_logs
  ADD COLUMN IF NOT EXISTS sender_email text,
  ADD COLUMN IF NOT EXISTS sender_name text,
  ADD COLUMN IF NOT EXISTS html_body text;
```

### 2. Edge Function `fetch-emails` aanpassen

- `sender_email` en `sender_name` opslaan uit `msg.from.emailAddress` (Outlook) of IMAP envelope
- `html_body` apart opslaan (de HTML content)
- `body` wordt de plain-text variant (strip tags of gebruik `bodyPreview` van Graph API)
- Subject niet meer vervuilen met `[van: ...]`
- Graph API call uitbreiden met `bodyPreview` field en `body.contentType`

### 3. EmailPage.tsx volledig verbeteren

**Lijst-weergave:**
- Toon `sender_name` of `sender_email` i.p.v. `customers?.name || "Onbekend"`
- Preview toont plain-text body snippet

**Detail-weergave:**
- Toon afzender: naam + e-mailadres
- HTML body renderen in een sandboxed `<iframe srcDoc={...}>` zodat de styling van de mail niet lekt
- Fallback naar plain-text body als er geen HTML is

**Compose dialog:**
- Voeg een vrij tekstveld toe voor "Aan" (e-mailadres) naast de klant-selector
- Optioneel: als je een klant selecteert, vul het e-mailadres automatisch in maar laat het bewerkbaar
- CC/BCC velden (optioneel, later)

### 4. Bestanden die wijzigen

| Bestand | Wijziging |
|---------|-----------|
| Migratie (SQL) | `sender_email`, `sender_name`, `html_body` kolommen |
| `supabase/functions/fetch-emails/index.ts` | Sender info + html_body opslaan, bodyPreview gebruiken, subject niet meer vervuilen |
| `src/pages/EmailPage.tsx` | Volledige UI upgrade: sender info, HTML rendering via iframe, compose met vrij e-mailadresveld |
| `src/hooks/useCommunicationLogs.ts` | Extra kolommen meenemen in select query |

