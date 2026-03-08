

## Fix: Offerte O-2026-001 terugzetten naar "concept"

De offerte voor test klant staat op `verzonden` na een mislukte e-Boekhouden sync. We zetten de status terug naar `concept` via een database migration zodat je hem opnieuw kunt versturen.

### Aanpak
- Eén SQL migration die de status van quote `3942c2b4-1249-493d-a5ee-3a320caed522` (O-2026-001) terugzet naar `concept`

```sql
UPDATE public.quotes 
SET status = 'concept' 
WHERE id = '3942c2b4-1249-493d-a5ee-3a320caed522';
```

Geen code-wijzigingen nodig — alleen een data-fix.

