

## Analyse huidige situatie

**Wat al werkt:**
- Monteurs (teamleden) kunnen worden **uitgenodigd** via Instellingen > Teamleden met rol "monteur" of "admin"
- Rollen worden opgeslagen in `user_roles` tabel (admin, monteur, super_admin)
- Sidebar verbergt admin-only pagina's voor monteurs (alleen Planning en Werkbonnen zichtbaar)
- Afspraken hebben een `assigned_to` veld (koppeling aan monteur)
- Planning heeft al een medewerker-filter dropdown

**Wat ontbreekt:**

### 1. Werkbonnen hebben geen `assigned_to` kolom
De `work_orders` tabel mist een `assigned_to` veld. Monteurs kunnen dus niet aan werkbonnen worden gekoppeld en werkbonnen worden niet per monteur gefilterd.

### 2. Monteurs zien alles van het bedrijf
Er is geen filtering op monteur-niveau: een monteur ziet alle afspraken en werkbonnen van het hele bedrijf, niet alleen de eigen.

### 3. Route optimalisatie werkt niet voor monteurs
De route-knop en -logica staan op de PlanningPage maar er is geen beperking zodat een monteur alleen eigen routes optimaliseert.

---

## Plan van aanpak

### Stap 1: Database migratie — `assigned_to` op `work_orders`
- Kolom `assigned_to UUID REFERENCES profiles(id)` toevoegen aan `work_orders`
- Bij het aanmaken van werkbonnen vanuit afspraken: `assigned_to` overnemen van de appointment

### Stap 2: Monteur-filtering in hooks
- **`useWorkOrders` / `usePaginatedWorkOrders`**: als `role === "monteur"`, filter op `assigned_to === user.id`
- **`useAppointments`**: als `role === "monteur"`, filter op `assigned_to === user.id`
- Admins blijven alles zien (met optionele filter per monteur)

### Stap 3: WorkOrderDialog — monteur-selector
- In WorkOrderDialog een "Toegewezen aan" dropdown toevoegen (alleen voor admins)
- Bij monteurs automatisch de eigen `user.id` als `assigned_to` instellen

### Stap 4: WorkOrdersPage — monteur-filter voor admins
- Filter dropdown toevoegen op werkbonnen-overzicht (vergelijkbaar met planning)
- Monteurs zien deze filter niet (zien alleen eigen werkbonnen)

### Stap 5: Route optimalisatie voor monteurs
- Monteurs kunnen hun eigen dag optimaliseren (assigned_to wordt automatisch hun user.id)
- Admins kunnen per monteur of voor iedereen optimaliseren (bestaande functionaliteit)

### Stap 6: createWorkOrderFromAppointment aanpassen
- `assigned_to` meenemen van de appointment naar de werkbon bij automatisch aanmaken

### Concrete wijzigingen

| Bestand | Wijziging |
|---|---|
| **DB migratie** | `ALTER TABLE work_orders ADD COLUMN assigned_to UUID REFERENCES profiles(id)` |
| `src/hooks/useWorkOrders.ts` | Filter op `assigned_to` voor monteurs; filter-param voor admins |
| `src/hooks/useAppointments.ts` | Filter op `assigned_to` voor monteurs |
| `src/pages/WorkOrdersPage.tsx` | Monteur-filter dropdown (admin-only) |
| `src/components/WorkOrderDialog.tsx` | "Toegewezen aan" selector |
| `src/utils/createWorkOrderFromAppointment.ts` | `assigned_to` overnemen |
| `src/pages/PlanningPage.tsx` | Monteur auto-filter bij rol=monteur |

