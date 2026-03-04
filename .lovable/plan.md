

## Plan: WhatsApp automation bugfix + E-mail tab op klantpagina

### Deel 1: Bug fix — WhatsApp automation "Ongeldige sessie"

**Oorzaak**: De `whatsapp-automation-trigger` edge function roept `whatsapp-send` aan met `SUPABASE_SERVICE_ROLE_KEY` als Bearer token. Maar `whatsapp-send` gebruikt `authenticateRequest()` die `getUser()` aanroept — dat faalt omdat een service role key geen user JWT is.

**Oplossing** in `supabase/functions/_shared/supabase.ts`:
- `authenticateRequest` uitbreiden om service role keys te herkennen. Als de Bearer token gelijk is aan de `SUPABASE_SERVICE_ROLE_KEY`, de auth overslaan en het `company_id` uit de request body halen (dat door de automation trigger al meegegeven wordt via de klant).

Alternatief (schoner): in `whatsapp-send` een aparte check toevoegen vóór `authenticateRequest` die detecteert of het een service-role call is, en dan `companyId` uit de request body haalt.

**Wijziging in `supabase/functions/whatsapp-send/index.ts`** (rond regel 112-113):
- Check of de Bearer token de service role key is
- Zo ja: haal `company_id` uit de request body (de automation trigger stuurt dit impliciet via de klant) of voeg een expliciet `company_id` veld toe aan de automation trigger payload
- Sla `authenticateRequest` over

**Wijziging in `supabase/functions/whatsapp-automation-trigger/index.ts`** (rond regel 169-175):
- Voeg `company_id: customer.company_id` toe aan de body die naar whatsapp-send gestuurd wordt

### Deel 2: E-mail tab op klantdetailpagina

De klantdetailpagina heeft al een "Communicatie" tab die alle communication_logs toont. De wens is:
1. Alle e-mails (verzonden + ontvangen) zichtbaar bij de klant
2. Vanuit de klant direct kunnen mailen — vrije mail én template

**Wijzigingen in `src/pages/CustomerDetailPage.tsx`**:

- Tab "Communicatie" hernoemen naar "E-mail" of een aparte "E-mail" tab toevoegen
- E-mail specifieke logs filteren op `channel === "email"`
- Bovenaan de tab twee knoppen: "Nieuwe e-mail" en "Template versturen"
- **Vrije e-mail**: een inline compose-formulier met To (vooringevuld met klant e-mail), Onderwerp, Body. Verstuurt via `send-email` edge function en logt in `communication_logs`.
- **Template e-mail**: een dropdown met beschikbare templates (uit `useEmailTemplates`). Bij selectie worden variabelen automatisch ingevuld (klantnaam, etc.) en kan de gebruiker versturen.

De bestaande `Communicatie` tab blijft bestaan als overzicht van alle kanalen.

### Bestanden die wijzigen

1. `supabase/functions/whatsapp-send/index.ts` — service role bypass in auth
2. `supabase/functions/whatsapp-automation-trigger/index.ts` — company_id toevoegen aan send payload
3. `src/pages/CustomerDetailPage.tsx` — E-mail tab met inbox, vrije mail compose, template mail

