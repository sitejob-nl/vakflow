

## Probleem analyse

Er zijn **drie problemen** gevonden:

### 1. Facebook pagina is gekoppeld aan het verkeerde bedrijf
De `meta_config` tabel toont dat je Facebook pagina ("Kas van de Meulengraaf") is gekoppeld aan `company_id: 2a5c7a99...` terwijl je ingelogd bent bij bedrijf `company_id: 62ab95a0...`. Dit betekent dat de OAuth-flow het verkeerde company_id heeft meegegeven in de state parameter. Alle berichten die via de webhook binnenkomen worden dus aan het verkeerde bedrijf gekoppeld, en door RLS zie je ze niet.

**Oplossing**: Update de `meta_config` rij zodat het `company_id` overeenkomt met je huidige bedrijf, OF ontkoppel en koppel opnieuw.

### 2. Webhook ontvangt geen berichten van Meta
Er zijn **nul logs** voor de `meta-webhook` Edge Function. Dit betekent dat Meta geen events naar de webhook stuurt. Mogelijke oorzaken:
- De webhook URL is niet (correct) geconfigureerd in het Meta Developer Portal
- De webhook verificatie is niet geslaagd
- De webhook subscriptions (messages, messaging_postbacks) zijn niet ingeschakeld voor je pagina

**Handmatige actie vereist in Meta for Developers**:
1. Ga naar je app → Webhooks
2. Stel de Callback URL in: `https://sigzpqwnavfxtvbyqvzj.supabase.co/functions/v1/meta-webhook`
3. Vul het Verify Token in (de waarde van je `META_WEBHOOK_VERIFY_TOKEN` secret)
4. Abonneer op de velden: `messages`, `messaging_postbacks`, `feed` (voor Messenger) en `messages` onder Instagram
5. Ga naar je Facebook Page Settings → koppel de webhook aan je pagina

### 3. Company ID fix via database
De snelste fix is om de bestaande `meta_config` rij te updaten naar het juiste company_id.

### Aanpassingen

| Wijziging | Beschrijving |
|-----------|-------------|
| Database migration | Update `meta_config.company_id` van `2a5c7a99...` naar `62ab95a0...` |
| `useMetaConversations.ts` | Voeg `company_id` filter toe aan de query (extra beveiliging naast RLS) |

### Handmatige stappen (voor jou)
1. Configureer de webhook URL in Meta Developer Portal (zie hierboven)
2. Controleer dat de webhook verificatie slaagt (test via de "Test" knop in het portal)
3. Abonneer je pagina op messaging events

