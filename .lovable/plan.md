

# Plan: Launch Readiness Fixes — Security, Performance & Scalability

Dit plan implementeert alle P0/P1 items uit de audit in de volgende volgorde.

---

## 1. SuperAdminRoute component + route guard

**Nieuw bestand**: `src/components/SuperAdminRoute.tsx`
- Checkt `isSuperAdmin` uit `useAuth()`
- Toont spinner bij `role === null`, redirect naar `/dashboard` als niet super_admin

**`src/App.tsx`**: Wrap `/superadmin` route in `<SuperAdminRoute>`

---

## 2. Companies tabel: credentials afschermen

**Database migratie**: Vervang de huidige SELECT policy op `companies` zodat alleen `super_admin` direct kan lezen. Admins worden doorverwezen naar `companies_safe` view.

```sql
DROP POLICY "Company admins and super_admins can view companies" ON companies;
CREATE POLICY "Only super admins can view companies directly"
  ON companies FOR SELECT TO authenticated
  USING (is_super_admin());
```

**Frontend aanpassingen** (SettingsPage, PlanningPage, OnboardingDialog):
- Vervang `.from("companies").select(...)` reads door `.from("companies_safe").select(...)`
- Updates/writes blijven op `companies` (die UPDATE policy is al admin-only)
- PlanningPage `outlook_refresh_token` check → gebruik `companies_safe` of `user_outlook_tokens`

---

## 3. Company-signup: generieke foutmeldingen

**`supabase/functions/company-signup/index.ts`**:
- Vervang `companyError.message` en `authError.message` door generieke tekst
- Log details server-side met `console.error`

---

## 4. Code-splitting met React.lazy

**`src/App.tsx`**:
- Alle pagina-imports omzetten naar `React.lazy(() => import(...))`
- `<Suspense fallback={<Loader2 spinner>}>` wrapper om de Routes

Pagina's die lazy worden: DashboardPage, MonteurDashboardPage, PlanningPage, CustomersPage, CustomerDetailPage, WorkOrdersPage, WorkOrderDetailPage, InvoicesPage, QuotesPage, CommunicationPage, EmailPage, WhatsAppPage, RemindersPage, SettingsPage, SuperAdminPage, ReportsPage, AssetsPage, MarketingPage, MetaCallbackPage, CompanySignupPage.

---

## 5. QueryClient globale defaults

**`src/App.tsx`**:
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false }
  }
});
```

---

## 6. Appointments realtime filter op company_id

**`src/hooks/useAppointments.ts`**:
- Voeg `filter: \`company_id=eq.${companyId}\`` toe aan de realtime subscription
- Guard met `if (!companyId) return;`

---

## 7. PWA naam fixen

**`vite.config.ts`**:
- `name: "Vakflow"`, `short_name: "Vakflow"`, `description` updaten

---

## 8. AdminRoute loading spinner

**`src/components/AdminRoute.tsx`**:
- Vervang `return null` door een centered `<Loader2>` spinner

---

## 9. Vite bundle splitting

**`vite.config.ts`**: Voeg `build.rollupOptions.output.manualChunks` toe:
```typescript
manualChunks: {
  recharts: ['recharts'],
  xlsx: ['xlsx'],
  googlemaps: ['@vis.gl/react-google-maps'],
}
```

---

## 10. Outlook sync foutmelding

**`src/hooks/useAppointments.ts`**:
- Bij sync-falen: toon toast met "Outlook sync mislukt" melding
- Afspraak wordt wel opgeslagen (fire-and-forget blijft, maar met feedback)

---

## Bestanden die worden aangepast

| Bestand | Wijziging |
|---------|-----------|
| `src/components/SuperAdminRoute.tsx` | Nieuw: route guard |
| `src/components/AdminRoute.tsx` | Spinner bij laden |
| `src/App.tsx` | Lazy imports, QueryClient config, SuperAdminRoute |
| `supabase/migrations/...` | Companies SELECT policy |
| `supabase/functions/company-signup/index.ts` | Generieke errors |
| `src/pages/SettingsPage.tsx` | companies_safe reads |
| `src/pages/PlanningPage.tsx` | companies_safe reads |
| `src/components/OnboardingDialog.tsx` | companies_safe reads |
| `src/hooks/useAppointments.ts` | Realtime filter + sync toast |
| `vite.config.ts` | PWA naam + manualChunks |

