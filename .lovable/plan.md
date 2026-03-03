

## Probleem

De `syncCustomerToEboekhouden` functie in `useCustomers.ts` wordt **altijd** aangeroepen bij het aanmaken/bijwerken van een klant, ongeacht of het bedrijf e-Boekhouden als boekhoudprovider gebruikt. Dit veroorzaakt een 400-fout wanneer er geen e-Boekhouden API-token is ingesteld.

De fout in de console: `e-Boekhouden klant sync mislukt: Edge Function returned a non-2xx status code`

## Oplossing

De `syncCustomerToEboekhouden` functie moet alleen worden aangeroepen wanneer `accounting_provider === "eboekhouden"` op het bedrijf is ingesteld.

### Aanpak

1. **`useCustomers.ts` aanpassen**: De `useCreateCustomer` en `useUpdateCustomer` hooks moeten eerst de `accounting_provider` van het bedrijf opvragen (via de `companies_safe` view of een aparte query) voordat ze de sync triggeren.

2. **Concrete implementatie**: 
   - Maak een helper die de `accounting_provider` checkt voordat de sync wordt aangeroepen
   - Gebruik de bestaande `companies_safe` view (die al beschikbaar is zonder admin-rechten) om de `accounting_provider` op te halen
   - Roep `syncCustomerToEboekhouden` alleen aan als `provider === "eboekhouden"`
   - Voeg ook een Rompslomp sync toe als `provider === "rompslomp"` en een Moneybird sync als `provider === "moneybird"` (optioneel, voor consistentie)

3. **Alternatief (eenvoudiger)**: Haal de `accounting_provider` op uit de `companies_safe` view in de `onSuccess` callback, en call de sync alleen conditioneel. Dit voorkomt onnodige edge function calls.

### Bestanden te wijzigen

- **`src/hooks/useCustomers.ts`**: Conditionele sync op basis van `accounting_provider`

