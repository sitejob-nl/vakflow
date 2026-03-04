

# Fix: WhatsApp config push routing op tenant_id

## Probleem

De flow is:
1. `whatsapp-register` maakt een rij aan: `{company_id, phone_number_id: "pending", tenant_id, webhook_secret}`
2. Connect stuurt later een config push naar `whatsapp-config` met het echte `phone_number_id`
3. **Bug**: `whatsapp-config` doet een `upsert` op `phone_number_id`, maar de bestaande rij heeft `"pending"` -- dus er wordt een NIEUWE rij aangemaakt zonder `company_id`
4. De webhook secret lookup pakt ook de eerste willekeurige rij in plaats van te scopen op de tenant

## Oplossing

### `supabase/functions/whatsapp-config/index.ts`

Twee fixes:

**1. Webhook secret lookup scopen op tenant_id**
- Lees eerst de body (nodig voor `tenant_id`), daarna verify
- Zoek webhook_secret via `WHERE tenant_id = body.tenant_id` in plaats van `.limit(1).maybeSingle()`

**2. Config push: UPDATE WHERE tenant_id in plaats van upsert op phone_number_id**
- Zoek de bestaande rij via `tenant_id` uit de body
- Update die rij met `phone_number_id`, `access_token`, `display_phone`, `waba_id`
- Dit zorgt ervoor dat de "pending" rij correct wordt bijgewerkt en `company_id` behouden blijft

### Database opschoning
- Verwijder eventuele orphaned rijen (rijen zonder `company_id` die door de oude upsert-bug zijn aangemaakt)

| Bestand | Actie |
|---------|-------|
| `supabase/functions/whatsapp-config/index.ts` | Secret lookup scopen op tenant_id + UPDATE i.p.v. upsert |
| Database | Orphaned rijen opschonen |

