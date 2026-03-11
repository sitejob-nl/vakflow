

# Fix: Exact Online edge functions niet gedeployed

## Probleem

De edge functions `exact-api`, `exact-sync-customers`, `exact-sync-invoices`, `exact-sync-quotes`, `exact-sync-items` en `exact-register` zijn aangemaakt in de codebase maar **nooit gedeployed** naar Supabase. Daarom krijg je "Failed to fetch" — de endpoints bestaan simpelweg niet.

Bewijs: alle zes functies hebben **nul logs**, terwijl `exact-config` (die eerder al bestond) wel werkt en logs toont.

## Oplossing

1. **Deploy alle nieuwe Exact edge functions** via de deploy tool:
   - `exact-api`
   - `exact-sync-customers`
   - `exact-sync-invoices`
   - `exact-sync-quotes`
   - `exact-sync-items`
   - `exact-register`

2. **Fix `exact-sync-customers` import** — het importeert `corsHeaders` maar gebruikt het nergens. Geen functioneel probleem maar kan compile-waarschuwing geven. Verwijder de ongebruikte import.

3. **Verifieer na deployment** door de edge function logs te controleren of de boot-berichten verschijnen.

Geen codewijzigingen nodig — alleen deployment.

