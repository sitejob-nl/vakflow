

# Fix: WhatsApp registratie faalt door unique constraint op `phone_number_id`

## Probleem

De edge function log toont:
```
duplicate key value violates unique constraint "idx_whatsapp_config_phone_number_id"
Key (phone_number_id)=(pending) already exists.
```

Bij registratie wordt `phone_number_id` op `"pending"` gezet. Maar er is een UNIQUE index op die kolom, en een ander bedrijf heeft al `"pending"` staan. Daardoor kan geen tweede bedrijf meer registreren.

## Oplossing

1. **Database migratie**: Verwijder de unique index `idx_whatsapp_config_phone_number_id` en maak een partial unique index aan die alleen niet-null en niet-"pending" waarden afdwingt:

```sql
DROP INDEX IF EXISTS idx_whatsapp_config_phone_number_id;
CREATE UNIQUE INDEX idx_whatsapp_config_phone_number_id 
  ON whatsapp_config (phone_number_id) 
  WHERE phone_number_id IS NOT NULL AND phone_number_id != 'pending';
```

Dit zorgt ervoor dat echte phone_number_id's uniek blijven, maar meerdere bedrijven tegelijk de waarde `"pending"` kunnen hebben.

## Bestanden

| Bestand | Actie |
|---------|-------|
| Database migratie | Partial unique index op `phone_number_id` |

Geen code-wijzigingen nodig — alleen de database constraint moet worden aangepast.

