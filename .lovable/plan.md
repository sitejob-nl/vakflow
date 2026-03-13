

## Analyse

**Database:** Alle 5 nieuwe tabellen (hexon_config, hexon_listings, voys_config, call_records, ai_agent_config), alle kolom-uitbreidingen (trade_vehicles +17 kolommen, vehicles +1, communication_logs +1), en de app_role enum uitbreiding (verkoop) bestaan al in de database. Geen migraties nodig.

**Edge Functions:** De 4 functies draaien al in Supabase maar ontbreken als bronbestanden in de repo:
- `supabase/functions/voys-webhook/` — niet aanwezig
- `supabase/functions/hexon-sync/` — niet aanwezig
- `supabase/functions/hexon-webhook/` — niet aanwezig
- `supabase/functions/hexon-portal-leads/` — niet aanwezig

**config.toml:** De `verify_jwt = false` entries voor deze 4 functions staan al in config.toml (eerder toegevoegd).

## Plan

4 bestanden aanmaken op basis van de geüploade broncode:

1. **`supabase/functions/voys-webhook/index.ts`** — index_54.ts (328 regels): Voys call webhook, customer matching, call_record upsert, transcriptie ophalen via Holodeck API, AI-verrijking, gemiste oproep → WhatsApp followup
2. **`supabase/functions/hexon-sync/index.ts`** — index_55.ts (325 regels): Push voertuigdata naar Hexon API, publish/unpublish/update/fetch_status acties, HexonAPI wrapper class
3. **`supabase/functions/hexon-webhook/index.ts`** — index_56.ts (170 regels): Ontvang Hexon event notifications (ad.status.changed, ad.online, ad.denied), update hexon_listings
4. **`supabase/functions/hexon-portal-leads/index.ts`** — index_57.ts (217 regels): Verwerk portaalleads, customer deduplicatie, lead aanmaken, AI intake trigger

Elke file wordt 1:1 overgenomen uit de uploads. Ze worden automatisch gedeployed na aanmaken.

