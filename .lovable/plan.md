

## Plan: Onderdelen/Voorraad op Materials-tabel

### Wat

Voorraadtelling toevoegen aan de bestaande `materials`-tabel: `stock_quantity` en `min_stock_level` kolommen. Automatische afboeking bij werkbon-afronding via een database trigger. Alert-badge in de sidebar wanneer materialen onder minimum zitten.

### Database

**Migration 1** — Kolommen toevoegen:
```sql
ALTER TABLE materials
  ADD COLUMN stock_quantity numeric NOT NULL DEFAULT 0,
  ADD COLUMN min_stock_level numeric NOT NULL DEFAULT 0;
```

**Migration 2** — Trigger voor automatische voorraadafboeking:

Een `AFTER UPDATE` trigger op `work_orders` die bij `status = 'afgerond'` alle gekoppelde `work_order_materials` ophaalt en per `material_id` de `stock_quantity` verlaagt. Security definer, zodat het altijd werkt ongeacht RLS.

```sql
CREATE OR REPLACE FUNCTION deduct_stock_on_wo_complete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'afgerond' AND OLD.status IS DISTINCT FROM 'afgerond' THEN
    UPDATE materials m
    SET stock_quantity = GREATEST(m.stock_quantity - wom.quantity, 0)
    FROM work_order_materials wom
    WHERE wom.work_order_id = NEW.id
      AND wom.material_id = m.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_deduct_stock_on_wo_complete
  AFTER UPDATE ON work_orders
  FOR EACH ROW EXECUTE FUNCTION deduct_stock_on_wo_complete();
```

### Frontend wijzigingen

**1. `src/hooks/useMaterials.ts`**
- `Material` interface: `stock_quantity` en `min_stock_level` toevoegen
- Nieuwe hook `useLowStockCount()`: query die count retourneert van materials waar `stock_quantity < min_stock_level AND min_stock_level > 0`

**2. `src/components/MaterialsSettings.tsx`**
- Twee extra velden in het formulier: "Voorraad" en "Min. voorraad"
- Extra kolommen in de tabel: "Voorraad" met rode tekst/badge als onder minimum
- Payload uitbreiden met `stock_quantity` en `min_stock_level`

**3. `src/components/Sidebar.tsx`**
- `useLowStockCount()` aanroepen
- Rode badge-dot tonen naast het Settings-icoon (of een apart "Materialen" menu-item) als count > 0

**4. `src/components/WorkOrderMaterials.tsx`**
- Bij catalogus-suggesties de huidige voorraad tonen (bijv. "12 op voorraad")
- Waarschuwing als gekozen hoeveelheid > beschikbare voorraad

### Geen edge function nodig
Alles draait op de bestaande tabel + een database trigger. De frontend leest gewoon de extra kolommen mee.

