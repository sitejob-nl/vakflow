

## Analyse: Is `sent_by = null` veilig?

**Ja, het is veilig.** De data-isolatie zit niet in `sent_by` maar in `company_id`:

1. **RLS policies** op `whatsapp_messages` filteren op `company_id = get_my_company_id()` — elk bedrijf ziet alleen eigen berichten
2. **De insert** in `whatsapp-send` zet altijd `company_id: companyId` — dat is het bedrijf dat de automation triggerde
3. `sent_by` is puur voor **attributie** (wie verstuurde het bericht), niet voor toegangscontrole

Berichten komen nooit bij andere bedrijven terecht omdat:
- De edge function haalt `companyId` op uit het `body.company_id` (bij service-role) of uit het profiel van de ingelogde gebruiker
- Het bericht wordt opgeslagen met die `company_id`
- RLS blokkeert toegang voor andere bedrijven

**Maar** — `null` is niet ideaal voor traceerbaarheid. Een betere aanpak:

### Plan

**1. `whatsapp-send/index.ts` aanpassen** (1 regel):
- In plaats van `sent_by: null` voor service-role calls, zet `sent_by: "system"` of bewaar het als `null` maar voeg een `metadata` veld toe met `{ source: "automation" }`.
- Aangezien `sent_by` een UUID-kolom is (FK naar auth.users), kan je er geen string "system" in zetten. `null` is dus de correcte waarde.

### Conclusie

De huidige implementatie met `sent_by: null` is **correct en veilig**:
- `company_id` zorgt voor isolatie, niet `sent_by`
- `sent_by` is nullable by design (UUID type, kan geen "system" string bevatten)
- Er is geen risico dat berichten bij andere bedrijven verschijnen

**Geen code-wijziging nodig.** De beveiliging zit in `company_id` + RLS, niet in `sent_by`.

