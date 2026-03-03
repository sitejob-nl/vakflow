

## Probleem

De oorzaak is gevonden. Het zit in twee lagen:

### 1. RLS laat super_admins alles zien
De SELECT policy op `communication_logs` bevat `OR is_super_admin()`. Hierdoor ziet een super_admin **alle** e-mails van **alle** bedrijven.

### 2. Frontend filtert niet op company_id
De `useCommunicationLogs` hook doet geen `.eq("company_id", ...)` filter. Bij normale gebruikers vangt RLS dit op, maar bij super_admins (en bij impersonatie) worden alle bedrijfsmails getoond.

Dit geldt trouwens voor **alle** tabellen met `OR is_super_admin()` in de SELECT policy, maar bij e-mail valt het het meest op.

---

## Oplossing

### A. Frontend filter toevoegen (`useCommunicationLogs.ts`)
De query uitbreiden met een expliciete `.eq("company_id", companyId)` filter zodat alleen mails van het actieve bedrijf (inclusief impersonatie) worden opgehaald:

```typescript
if (companyId) {
  query = query.eq("company_id", companyId);
}
```

De hook krijgt `companyId` als parameter vanuit de `useAuth()` context.

### B. EmailPage.tsx aanpassen
`companyId` doorgeven aan `useCommunicationLogs()` zodat het filter actief is.

### Bestanden die wijzigen

| Bestand | Wijziging |
|---------|-----------|
| `src/hooks/useCommunicationLogs.ts` | `companyId` parameter toevoegen + `.eq("company_id", companyId)` filter |
| `src/pages/EmailPage.tsx` | `companyId` uit `useAuth()` doorgeven aan de hook |

