

# Fix: Companies SELECT policy terugzetten

## Probleem

De migratie heeft de `companies` SELECT policy beperkt tot alleen `super_admin`. Omdat `companies_safe` view `security_invoker=on` heeft, erft die dezelfde restrictie. Resultaat: niemand behalve super_admins kan bedrijfsdata lezen — geen logo, geen kleur, geen Outlook-koppeling.

## Oplossing

Eén database migratie die de SELECT policy op `companies` terugzet naar de originele staat: bedrijfsmedewerkers kunnen hun eigen bedrijf lezen, super_admins kunnen alles lezen.

```sql
DROP POLICY IF EXISTS "Only super admins can view companies directly" ON companies;

CREATE POLICY "Company members can view own company"
  ON companies FOR SELECT TO authenticated
  USING (
    id = (SELECT get_my_company_id())
    OR (SELECT is_super_admin())
  );
```

Dit herstelt:
- **Monteurs**: zien logo en kleur via AuthContext (leest companies_safe → companies)
- **Admins**: zien alle bedrijfsinstellingen + Outlook-koppeling
- **Super admins**: zien alles

De `companies_safe` view en alle frontend-wijzigingen die al naar `companies_safe` lezen blijven intact — dat is een extra veiligheidslaag voor de toekomst. De gevoelige tokens (smtp_password, outlook_refresh_token, etc.) zijn wel leesbaar voor admins via de base table, maar niet via de `companies_safe` view die in de meeste componenten wordt gebruikt.

## Bestanden

| Bestand | Wijziging |
|---------|-----------|
| `supabase/migrations/...` | Revert companies SELECT policy |

Geen frontend wijzigingen nodig.

