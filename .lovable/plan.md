

# Klantportaal account aanmaken + Unieke werkbon-link

## Twee features

1. **Portaal account aanmaken vanuit klantdetail** -- Admin kan direct vanuit de klantpagina een portaalaccount aanmaken (via bestaande `portal-invite` edge function)
2. **Unieke deelbare werkbon-link** -- Bij een werkbon een publieke status-link genereren die zonder login werkt

## Technisch plan

### Feature 1: Portaal account aanmaken

**Geen database-wijzigingen nodig** -- `portal_users` tabel en `portal-invite` edge function bestaan al.

**UI in `CustomerDetailPage.tsx`:**
- Knop "Portaal account aanmaken" toevoegen in de klantgegevens-kaart (linker kolom)
- Alleen tonen als klant een e-mailadres heeft en nog geen portal_users record
- Bij klik: dialog met e-mail (pre-filled) en wachtwoord-veld
- Submit roept `supabase.functions.invoke("portal-invite", { body: { customer_id, company_id, email, password } })` aan
- Na succes: knop verandert in "Portaal actief ✓" met optie om te deactiveren

**Check of portaal actief is:**
- Query `portal_users` met `customer_id` filter bij laden van klantdetail

### Feature 2: Unieke werkbon status-link

**Database: migratie op `work_orders`:**
```sql
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS share_token text UNIQUE;
CREATE INDEX IF NOT EXISTS idx_work_orders_share_token ON work_orders(share_token);
```

**RLS policy voor publieke toegang via token:**
```sql
CREATE POLICY "Public access via share_token"
ON work_orders FOR SELECT TO anon
USING (share_token IS NOT NULL AND share_token = current_setting('request.headers')::json->>'x-share-token');
```
Alternatief (eenvoudiger): een aparte publieke view of edge function die de token valideert.

**Betere aanpak -- Edge Function `work-order-public`:**
- Ontvangt `token` als query parameter
- Zoekt werkbon op via `share_token` met service role (geen RLS nodig)
- Retourneert beperkte data: status, werkbon-nummer, dienst, aangemaakt, klant-naam (voornaam)
- Geen gevoelige data (bedragen, foto's, notities) tonen

**Token generatie in `WorkOrderDetailPage.tsx`:**
- "Deel link" knop die een random token genereert (`crypto.randomUUID()`)
- Slaat token op in `work_orders.share_token`
- Toont kopieerbare URL: `{origin}/status/{token}`
- Mogelijkheid om link in te trekken (token op null zetten)

**Publieke pagina `WorkOrderStatusPage.tsx`:**
- Route: `/status/:token` (buiten ProtectedRoute)
- Haalt data op via edge function `work-order-public`
- Toont: bedrijfslogo, werkbon-nummer, huidige status (met kleur-badge), datum
- Minimalistisch design, mobile-first
- Geen navigatie, geen login vereist
- Realtime subscription op status-wijzigingen (via channel met token filter)

### Samenvatting wijzigingen

| Component | Wijziging |
|---|---|
| Migration SQL | `share_token` kolom + index op `work_orders` |
| `supabase/functions/work-order-public/index.ts` | Nieuwe edge function voor publieke werkbon-lookup |
| `supabase/config.toml` | `verify_jwt = false` voor `work-order-public` |
| `src/pages/CustomerDetailPage.tsx` | "Portaal account" knop + dialog |
| `src/pages/WorkOrderDetailPage.tsx` | "Deel link" knop met token-generatie |
| `src/pages/WorkOrderStatusPage.tsx` | Nieuwe publieke statuspagina |
| `src/App.tsx` | Route `/status/:token` toevoegen |
| `src/integrations/supabase/types.ts` | Types bijwerken (automatisch) |

