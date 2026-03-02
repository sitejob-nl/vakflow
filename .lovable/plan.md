

## Plan: Rompslomp als leidend systeem voor facturen

### Wat de gebruiker wil

1. Bij het aanmaken van een factuur: direct naar Rompslomp pushen en het factuurnummer + data van Rompslomp terug ophalen en tonen
2. Alleen de Rompslomp PDF tonen (niet de eigen Vakflow PDF) wanneer Rompslomp gekoppeld is
3. Factuurnummer van Rompslomp is leidend

### Wijzigingen

**1. Edge Function: `sync-rompslomp/index.ts` — nieuwe actie `create-invoice`**

Een nieuwe actie die één factuur pusht naar Rompslomp en de Rompslomp-data teruggeeft:
- Ontvangt de Vakflow `invoice_id`
- Pusht naar Rompslomp (`POST /sales_invoices` met `_publish: true`)
- Haalt direct daarna de volledige factuur op (`GET /sales_invoices/{id}`) om het factuurnummer en bedragen te krijgen
- Update de Vakflow factuur met `rompslomp_id` en het Rompslomp `invoice_number`
- Retourneert de Rompslomp data aan de frontend

**2. Frontend: `InvoiceDialog.tsx` — auto-sync na aanmaken**

Na succesvol aanmaken van een factuur (wanneer `accountingProvider === "rompslomp"`):
- Roep `create-invoice` aan met het nieuwe factuur-ID
- Update de factuur met het Rompslomp factuurnummer
- Toon een toast met het Rompslomp factuurnummer

**3. Frontend: `InvoicesPage.tsx` — PDF knop logica**

Wanneer `accountingProvider === "rompslomp"`:
- Verberg de standaard "PDF" knop als de factuur een `rompslomp_id` heeft
- Toon alleen de "Rompslomp PDF" knop (hernoem naar gewoon "PDF")
- Toon het Rompslomp factuurnummer in de preview header
- Bij e-mail verzending: gebruik de Rompslomp PDF in plaats van de eigen PDF

**4. Factuurnummer weergave**

Het `invoice_number` veld wordt overschreven met het nummer uit Rompslomp. Hierdoor toont de hele UI automatisch het juiste nummer.

### Technisch detail

```text
Gebruiker maakt factuur aan
  → InvoiceDialog: createInvoice.mutateAsync(payload)
    → Vakflow DB: factuur opgeslagen met auto-nummer
  → supabase.functions.invoke("sync-rompslomp", { body: { action: "create-invoice", invoice_id: "..." } })
    → Edge Function: POST /sales_invoices (push naar Rompslomp)
    → Edge Function: GET /sales_invoices/{id} (haal Rompslomp data op)
    → Edge Function: UPDATE invoices SET rompslomp_id, invoice_number, status='verzonden'
  → Frontend: invalidate queries → factuur verschijnt met Rompslomp nummer
```

### Bestanden

| Bestand | Wijziging |
|---------|-----------|
| `supabase/functions/sync-rompslomp/index.ts` | Nieuwe `create-invoice` actie |
| `src/components/InvoiceDialog.tsx` | Auto-sync naar Rompslomp na aanmaken |
| `src/pages/InvoicesPage.tsx` | PDF knop: alleen Rompslomp PDF tonen, e-mail met Rompslomp PDF |

