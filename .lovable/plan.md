

# Boekhouding als aparte pagina — Aangepast plan

## Aanpassingen o.b.v. feedback

1. **Route `/boekhouding`** i.p.v. `/administratie` — voorkomt verwarring met eigen Facturatie/Offertes modules
2. **Informatieve placeholders** voor providers zonder beheer-UI (e-Boekhouden, Exact, SnelStart, WeFact) — geen "Coming soon" maar uitleg dat sync automatisch verloopt + link naar provider
3. **Empty state CTA** in sidebar wanneer geen provider is ingesteld — "Koppel je boekhouding" met link naar settings
4. **Provider-switching** — parkeren voor nu, maar de pagina toont alleen de actieve provider

## Bestanden

| Bestand | Actie |
|---------|-------|
| `src/pages/AccountingAdminPage.tsx` | **Nieuw** — full-width pagina, rendert provider-component of informatieve placeholder |
| `src/components/RompslompAdmin.tsx` | **Nieuw** — tabbed wrapper (contacten/facturen/offertes/producten), verplaatst uit settings |
| `src/components/settings/SettingsAccountingTab.tsx` | Verwijder `RompslompManagementSection` + `MoneybirdManagementSection`, lazy imports, tab state — alleen config behouden |
| `src/App.tsx` | Route `/boekhouding` toevoegen (AdminRoute) |
| `src/hooks/useNavigation.tsx` | `accounting` page type toevoegen |
| `src/components/Sidebar.tsx` | Nav-item "Boekhouding" in sectie "Administratie", conditioneel op `accounting_provider`. Zonder provider: toon "Koppel boekhouding" item met link naar `/settings` (accounting tab) |
| `src/config/industryConfig.ts` | `"accounting"` toevoegen aan alle industry modules arrays |

## AccountingAdminPage logica

```text
provider === "moneybird"  → <MoneybirdAdmin />
provider === "rompslomp"  → <RompslompAdmin />
provider === "exact"      → <ProviderPlaceholder name="Exact Online" />
provider === "eboekhouden"→ <ProviderPlaceholder name="e-Boekhouden" />
provider === "snelstart"  → <ProviderPlaceholder name="SnelStart" />
provider === "wefact"     → <ProviderPlaceholder name="WeFact" />
geen provider             → redirect naar /settings + toast
```

ProviderPlaceholder toont: "Je boekhouding wordt automatisch gesynchroniseerd met [provider]. Beheer je facturen, contacten en producten direct in [provider]." + link naar provider website + link naar sync-instellingen.

## Sidebar gedrag

- Provider ingesteld → toon "Boekhouding" nav-item met `BookOpen` icon
- Geen provider → toon "Koppel boekhouding" met subtiele styling + navigeert naar `/settings` (accounting tab)

De sidebar leest `accounting_provider` via `useAuth` context (al beschikbaar via `companyId` + een kleine query, of we voegen het toe aan de auth context). Simpelste aanpak: een kleine `useAccountingProvider` hook die cached uit `companies_safe`.

