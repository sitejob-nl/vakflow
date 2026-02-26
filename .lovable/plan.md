

## Probleem gevonden

Er zijn **2 kritieke fouten** waardoor de WhatsApp-koppeling niet werkt:

### 1. Verkeerde webhook URL (hoofdoorzaak)
In `src/pages/SettingsPage.tsx` regel 1432 staat de webhook URL nog naar het **oude** Supabase-project:
```
https://hhozgcmkickfdesnlpgs.supabase.co/functions/v1/whatsapp-webhook
```
Dit moet zijn:
```
https://sigzpqwnavfxtvbyqvzj.supabase.co/functions/v1/whatsapp-webhook
```

Hierdoor wordt de tenant geregistreerd met een webhook URL die niet meer bestaat. SiteJob Connect stuurt config-pushes en inkomende berichten naar het verkeerde project.

### 2. Missende JWT-configuratie in config.toml
De edge functions `whatsapp-webhook` en `whatsapp-config` moeten bereikbaar zijn zonder JWT (ze worden aangeroepen door SiteJob Connect, niet door een ingelogde gebruiker). Er ontbreekt `verify_jwt = false` configuratie in `supabase/config.toml`.

### 3. De `whatsapp_config` tabel is leeg
Er is nog geen tenant geregistreerd — de status-check retourneert `connected: false`, waardoor de WhatsApp-pagina "niet gekoppeld" toont.

---

## Implementatieplan

### Stap 1: Fix webhook URL in SettingsPage.tsx
- Wijzig regel 1432: vervang `hhozgcmkickfdesnlpgs` door `sigzpqwnavfxtvbyqvzj`

### Stap 2: Update config.toml met JWT-uitzonderingen
- Voeg `verify_jwt = false` toe voor `whatsapp-webhook`, `whatsapp-config`, en `whatsapp-register`

### Stap 3: Hertest de koppeling
- Na deze fixes kan de gebruiker opnieuw op "Koppel WhatsApp" klikken in Instellingen

