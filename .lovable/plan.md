

## Systeemanalyse Vakflow

Na uitgebreide analyse van de codebase, hooks, RLS policies, edge functions en workflows zijn de volgende verbeterpunten gevonden, gegroepeerd op prioriteit.

---

### KRITIEK - Data-lekken (super_admin ziet data van alle bedrijven)

Dit is het probleem dat je net meldde bij e-mail, maar het bestaat op **meer plekken**:

| Hook / Pagina | Probleem |
|---|---|
| `useAssets` | **Geen** `companyId` filter in query (regel 47-49). Super_admin ziet alle objecten van alle bedrijven |
| `useMaintenanceLogs` | Geen company filter |
| `useWhatsAppMessages` | **Geen** `companyId` filter. Super_admin ziet alle WhatsApp berichten |
| `useDashboard` (`useTodayAppointments`, `useDashboardStats`, `useRecentWorkOrders`, `useReminders`) | **Geen enkele** `companyId` filter. Dashboard toont aggregaten over alle bedrijven heen voor super_admins |
| `useAppointmentsForDay` | Geen `companyId` filter (wordt gebruikt in de planning) |

**Hooks die het WEL goed doen:** `useCustomers`, `useWorkOrders`, `useInvoices`, `useQuotes`, `useTodos`, `useTimeEntries`, `useMaterials`, `useAppointments` (weekview), `useReports`, `useCommunicationLogs` (na recente fix).

---

### HOOG - Ontbrekende functionaliteit & workflow-gaps

1. **Geen paginatie** - Alle list-hooks laden alle data in één keer (`useCustomers`, `useWorkOrders`, `useInvoices`, etc.). Bij 1000+ bedrijven met elk honderden records raakt dit de Supabase 1000-rij limiet en wordt de app traag. Server-side paginatie is nodig.

2. **Geen error boundaries** - Als een pagina crasht, krijgt de gebruiker een wit scherm. Er is geen React Error Boundary component.

3. **Ontbrekende realtime op belangrijke tabellen** - Alleen `appointments`, `notifications` en `whatsapp_messages` hebben realtime subscriptions. Werkbonnen, facturen en klanten updaten niet automatisch wanneer collega's wijzigingen maken.

4. **`useWorkOrder` (enkel) mist companyId check** - De `useWorkOrder(id)` query (regel 28-42) doet geen company filter. Een super_admin zou via een directe URL een werkbon van een ander bedrijf kunnen openen zonder te impersoneren.

---

### MEDIUM - Beveiligings- & architectuur-issues

5. **`companies` tabel bevat gevoelige data zonder view** - Kolommen als `smtp_password`, `outlook_refresh_token`, `rompslomp_api_token`, `moneybird_api_token`, `eboekhouden_api_token` zijn leesbaar voor elke authenticated user van dat bedrijf via de SELECT policy. Een view die deze kolommen uitsluit zou veiliger zijn.

6. **`profiles` tabel bevat legacy SMTP-velden** - `smtp_email`, `smtp_password`, `smtp_host`, `smtp_port` staan zowel op `profiles` als `companies`. Deze duplicatie kan verwarring veroorzaken.

7. **`as any` casts verspreid door de codebase** - Vrijwel elke insert/update gebruikt `as any` om TypeScript-fouten te onderdrukken. Dit verbergt potentiële bugs.

8. **Supabase Realtime kanalen zonder specifieke filters** - `appointments-realtime` channel luistert naar ALLE appointment changes zonder `company_id` filter, wat onnodig verkeer genereert voor multi-tenant.

---

### LAAG - Verbeteringen voor schaalbaarheid & UX

9. **Dashboard hooks niet company-scoped** - Alle 4 dashboard queries moeten `companyId` filter krijgen (nu ziet super_admin aggregaten van alle bedrijven).

10. **Geen offline/PWA queueing** - PWA is geconfigureerd maar er is geen offline data-queueing. Monteurs in het veld verliezen wijzigingen bij slechte verbinding.

11. **`useReminders` doet client-side berekening over alle klanten** - Dit schaalt niet bij grote datasets. Zou een database function moeten zijn.

12. **Geen soft-delete** - Verwijderen is permanent. Voor een SaaS-platform is soft-delete (met `deleted_at` kolom) veiliger.

---

### Aanbevolen aanpak (volgorde)

1. **Eerst:** Fix alle data-lekken (companyId filters toevoegen aan `useAssets`, `useWhatsAppMessages`, `useDashboard` hooks, `useAppointmentsForDay`) - **hoogste prioriteit**
2. **Dan:** Gevoelige kolommen in `companies` afschermen met een view
3. **Daarna:** Server-side paginatie voor de grootste tabellen
4. **Tot slot:** Error boundaries, realtime uitbreiden, offline support

