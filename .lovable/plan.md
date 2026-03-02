

## Probleem

De `whatsapp-register` edge function probeert altijd een **nieuwe tenant** aan te maken bij SiteJob Connect, maar er bestaat al een tenant (`635800af-...`) in de `whatsapp_config` tabel. SiteJob Connect weigert daarom met "al gekoppeld".

## Oplossing

Pas `supabase/functions/whatsapp-register/index.ts` aan zodat het eerst checkt of er al een `tenant_id` bestaat in `whatsapp_config`. Zo ja: sla de registratie over en geef de bestaande `tenant_id` terug, zodat de popup gewoon geopend kan worden.

### Wijziging in `whatsapp-register/index.ts`

- Na authenticatie: query `whatsapp_config` voor bestaande `tenant_id`
- Als `tenant_id` gevonden en niet null → return direct `{ tenant_id, existing: true }` zonder SiteJob Connect aan te roepen
- Alleen bij geen bestaande tenant → registreer nieuw bij SiteJob Connect (huidige flow)

Dit is een minimale wijziging van ~10 regels in één bestand.

