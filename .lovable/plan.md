

## Probleem

De `pull-invoices` actie faalt met: `invalid input syntax for type date: "/Date(1774396800000)/"`.

Exact Online OData v3 retourneert datums in het formaat `/Date(1774396800000)/` (Unix timestamp in milliseconden), maar de code verwacht ISO 8601 (`2026-01-15T00:00:00`) en doet `split("T")[0]`.

Daarnaast is `InvoiceNumber` null voor sommige facturen, waardoor de foutmelding "null:" toont.

## Oplossing

**1. `sync-exact/index.ts` -- Voeg een OData date parser toe**

Een helper functie die `/Date(...)/ ` omzet naar `YYYY-MM-DD`:

```ts
function parseODataDate(val: unknown): string | null {
  if (!val) return null;
  const s = String(val);
  const match = s.match(/\/Date\((\d+)\)\//);
  if (match) {
    return new Date(Number(match[1])).toISOString().split("T")[0];
  }
  if (s.includes("T")) return s.split("T")[0];
  return s;
}
```

**2. Pas `pull-invoices` aan om de parser te gebruiken**

Vervang:
- `inv.InvoiceDate.split("T")[0]` → `parseODataDate(inv.InvoiceDate)`
- `inv.DueDate.split("T")[0]` → `parseODataDate(inv.DueDate)`

**3. Pas ook `sync-invoices` en andere datum-velden aan**

Dezelfde parser toepassen op alle plekken waar Exact datums worden gelezen (pull-contacts, pull-quotes, etc.).

| Bestand | Wijziging |
|---------|-----------|
| `supabase/functions/sync-exact/index.ts` | OData date parser + toepassen op alle datum-velden |

