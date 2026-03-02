

## Rompslomp PDF downloaden

### Wat er moet gebeuren

Een knop toevoegen naast de bestaande "PDF" knop waarmee de factuur-PDF direct uit Rompslomp gedownload kan worden. Dit is alleen beschikbaar voor facturen die al gesynchroniseerd zijn (met een `rompslomp_id`).

### Wijzigingen

**1. Edge Function: `supabase/functions/sync-rompslomp/index.ts`**

Nieuwe actie `download-pdf` toevoegen die:
- De `rompslomp_id` van de factuur ontvangt
- `GET /companies/{id}/sales_invoices/{rompslomp_id}/pdf` aanroept
- De PDF binary response doorgeeft aan de client

Hiervoor is een nieuwe helper nodig (`rompslompGetRaw`) die de response als ArrayBuffer retourneert in plaats van JSON.

**2. Frontend: `src/pages/InvoicesPage.tsx`**

Een extra knop "Rompslomp PDF" toevoegen die verschijnt wanneer `selected.rompslomp_id` bestaat. Deze roept de edge function aan met `action: "download-pdf"` en triggert een download.

**3. Frontend hook: `src/hooks/useInvoices.ts`**

Geen nieuwe hook nodig — de download wordt direct via `supabase.functions.invoke` aangeroepen vanuit de pagina (net zoals de bestaande PDF-knop werkt).

### Technisch detail

```text
User klikt "Rompslomp PDF"
  → supabase.functions.invoke("sync-rompslomp", { body: { action: "download-pdf", rompslomp_id: "123" } })
    → Edge Function: GET https://app.rompslomp.nl/api/v1/companies/{id}/sales_invoices/123/pdf
    → Return PDF bytes
  → Browser: Blob → download link → click
```

