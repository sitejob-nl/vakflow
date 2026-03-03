

## Analyse & Plan

### 1. Bug: Variabelen mapping in edge function

Er zit een bug in `trigger-email-automation/index.ts`. De `messageTypeMap` vertaalt trigger types naar verkeerde `message_type` waarden:

```
work_order_completed → "work_order_summary"  (FOUT)
invoice_sent → "appointment_confirmation"    (FOUT)
```

Maar in `auto_message_settings` worden de waarden opgeslagen als `work_order_completed` en `invoice_sent` (direct van `TRIGGER_TYPES`). Hierdoor vindt de edge function nooit een match en worden er geen e-mails verstuurd.

**Fix**: Verwijder de `messageTypeMap` en gebruik `trigger_type` direct als `message_type` filter.

### 2. Auth bug in edge function

De edge function gebruikt `supabaseUser.auth.getClaims()` wat geen standaard Supabase method is. Dit moet `supabaseUser.auth.getUser()` zijn.

**Fix**: Vervang getClaims door getUser().

### 3. Visuele E-mail Builder (vervanging raw HTML editor)

De huidige editor toont een raw HTML textarea — onbruikbaar voor normale gebruikers. We bouwen een blok-gebaseerde visuele editor zonder externe dependencies.

**Aanpak**: Een sectie-gebaseerde editor waar gebruikers blokken kunnen toevoegen, verwijderen, herschikken en bewerken. Elk blok heeft een type en bewerkbare inhoud.

**Bloktypen**:
- **Header** — bedrijfslogo + titel (automatisch gevuld vanuit bedrijfsgegevens)
- **Tekst** — vrij tekstveld met variabele-knoppen
- **Info-tabel** — key-value rijen (bijv. Werkbon: {{werkbonnummer}}, Bedrag: {{bedrag}})
- **Knop** — CTA button met tekst + URL
- **Scheidingslijn** — horizontale lijn
- **Footer** — bedrijfsnaam + adres

**UI**:
- Linkerkolom: lijst van blokken met omhoog/omlaag/verwijder knoppen
- Per blok: inline bewerking (contentEditable of inputs)
- Variabele-knoppen boven de editor
- Preview tab blijft (iframe met gegenereerde HTML)
- Optionele "HTML" tab voor power users

**Hoe het werkt**:
- State is een array van blok-objecten `{ type, content, settings }`
- Bij opslaan wordt de array geconverteerd naar e-mail-compatibele HTML (table-based layout)
- Bij laden van bestaande templates: als de HTML niet van de builder komt, toon een "HTML modus" fallback
- Bedrijfslogo en kleur worden automatisch ingeladen

### Bestanden

| Bestand | Actie |
|---------|-------|
| `src/components/EmailTemplateEditor.tsx` | Volledig herschrijven: blok-gebaseerde visuele editor |
| `supabase/functions/trigger-email-automation/index.ts` | Fix messageTypeMap bug + auth bug |

