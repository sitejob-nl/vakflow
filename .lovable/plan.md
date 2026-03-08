

## Fix: "Tenant not active" error afvangen in sync-exact

### Probleem
De `getExactToken` functie (regel 27) roept het externe SiteJob Connect project aan voor een access token. Die geeft "Tenant not active" terug. De error handler op regel 203-208 vangt alleen `"REAUTH_REQUIRED"` op — "Tenant not active" valt door naar de generieke catch op regel 856 en geeft een kale 500 error.

### Oorzaak
De tenant in het externe project (`xeshjkznwdrxjjhbpisn`) is niet actief. Dit kan betekenen:
- De Exact Online autorisatie is verlopen
- De tenant is gedeactiveerd in SiteJob Connect

### Wijziging: sync-exact/index.ts — Token error handling uitbreiden

**Bestand:** `supabase/functions/sync-exact/index.ts`

Regel 200-209: breid de catch uit om ook "Tenant not active" als reauth-scenario te behandelen:

```typescript
try {
  tokenData = await getExactToken(config.tenant_id, config.webhook_secret);
} catch (err: any) {
  if (err.message === "REAUTH_REQUIRED" || err.message === "Tenant not active") {
    await supabaseAdmin.from("exact_config").update({ status: "error" }).eq("company_id", companyId);
    return jsonRes({ 
      error: "Exact Online koppeling niet actief. Koppel opnieuw via instellingen.", 
      needs_reauth: true 
    }, 401);
  }
  throw err;
}
```

Dit zorgt ervoor dat:
1. De `exact_config` status wordt bijgewerkt naar `"error"` zodat de UI kan tonen dat er een probleem is
2. De frontend een duidelijke Nederlandse foutmelding toont via de soft-error toast ("Boekhoudkoppeling niet compleet — Offerte is wel opgeslagen")
3. De offerte gewoon lokaal wordt opgeslagen zonder blokkerende fout

### Na de code-fix
De tenant moet opnieuw gekoppeld worden in het SiteJob Connect project. Dat is een externe actie, geen code-wijziging.

| Bestand | Wijziging |
|---|---|
| `supabase/functions/sync-exact/index.ts` | "Tenant not active" toevoegen aan reauth-catch |

