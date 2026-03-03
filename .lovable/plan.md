

## Probleem

De SQL-migratie om `outlook_refresh_token` en `rompslomp_api_token` te wissen is niet uitgevoerd. SiteJob heeft nog steeds een versleuteld token (2433 tekens) dat met de oude key is versleuteld, waardoor elke aanroep van `outlook-calendar` faalt met "Decryption failed".

## Oplossing

Een nieuwe migratie aanmaken die de oude tokens op NULL zet voor SiteJob:

```sql
UPDATE companies 
SET outlook_refresh_token = NULL, 
    rompslomp_api_token = NULL 
WHERE id = '2a5c7a99-0bcd-4d1d-b541-c97e7e3e701e';
```

## Na de migratie

1. De "Decryption failed" fouten stoppen direct
2. De Outlook agenda toont een melding dat Outlook niet geconfigureerd is
3. Je kunt Outlook opnieuw koppelen via **Instellingen > E-mail** — dan wordt een nieuw refresh token versleuteld met de huidige key

## Technische details

- Alleen de `companies` tabel voor SiteJob wordt aangepast
- Geen schema-wijzigingen, alleen data-update
- De `outlook-calendar` edge function retourneert netjes "Outlook niet geconfigureerd" wanneer het token NULL is

