

## Plan: SuperAdmin schaalbaar maken voor 1000+ bedrijven

Het SuperAdmin dashboard is functioneel correct maar heeft twee schaalproblemen die breken bij groei.

### Probleem 1: N+1 queries in bedrijventabel

`SuperAdminPage.tsx` regels 51-63 doen `Promise.all(data.map(...))` — bij 500 bedrijven zijn dat 1500 parallelle Supabase queries. Daarnaast is er een 1000-rij limiet op de companies query zelf.

**Oplossing**: Maak een database functie `get_company_stats()` die in een enkele query alle counts per company retourneert. Aanroepen via `supabase.rpc("get_company_stats")`.

### Probleem 2: Geen paginatie

Alle bedrijven worden in een keer opgehaald (max 1000 door Supabase limiet).

**Oplossing**: Server-side paginatie met `.range(from, to)` en page state. Toon 25 bedrijven per pagina met vorige/volgende knoppen.

### Probleem 3: SuperAdminStats chart data

`SuperAdminStats.tsx` haalt `created_at` van alle companies/customers/work_orders op voor de groei-chart — breekt bij 1000+ rijen.

**Oplossing**: Gebruik per-maand count queries met `.gte()` en `.lt()` filters (18 head-count queries i.p.v. 3 volledige dataset fetches).

---

### Implementatie

**Stap 1 — Migratie: `get_company_stats()` functie**

```sql
CREATE OR REPLACE FUNCTION get_company_stats()
RETURNS TABLE(company_id uuid, customer_count bigint, user_count bigint, work_order_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id,
    (SELECT count(*) FROM customers WHERE customers.company_id = c.id),
    (SELECT count(*) FROM profiles WHERE profiles.company_id = c.id),
    (SELECT count(*) FROM work_orders WHERE work_orders.company_id = c.id)
  FROM companies c;
$$;
```

**Stap 2 — `SuperAdminPage.tsx`**: Vervang de N+1 `Promise.all(data.map(...))` door een enkele `supabase.rpc("get_company_stats")` call. Voeg paginatie toe met `.range()` en pagina-knoppen.

**Stap 3 — `SuperAdminStats.tsx`**: Vervang de 3x `select("created_at")` calls door 18 head-count queries met datumfilters voor de groei-chart. Vervang `select("status")` door aparte count queries per status.

### Bestanden
- Nieuwe migratie: `get_company_stats()` functie
- `src/pages/SuperAdminPage.tsx` — RPC call + paginatie (25 per pagina)
- `src/components/SuperAdminStats.tsx` — server-side counts voor charts

