

## Analyse

De `publish-post` actie in de edge function stuurt de post naar Facebook via de Graph API, maar:

1. **De response van Facebook wordt niet gecontroleerd** -- als Facebook een error teruggeeft (bijv. onvoldoende permissies, verlopen token), toont de frontend toch "Post gepubliceerd" omdat `supabase.functions.invoke` geen error gooit bij een 200 response van de edge function (zelfs als de body een Facebook error bevat).

2. **De post wordt niet opgeslagen** in `meta_page_posts` na publicatie.

3. **Mogelijke oorzaak**: De Facebook Page Access Token heeft mogelijk niet de `pages_manage_posts` of `publish_pages` permissie. Of het token is verlopen. De `publish-post` actie doet een `graphPost` maar controleert niet of `result.id` aanwezig is (succes) of `result.error` (fout).

## Oplossing

| Bestand | Wijziging |
|---------|-----------|
| `supabase/functions/meta-api/index.ts` | `publish-post`: controleer of Facebook `result.id` teruggeeft (succes) of `result.error` (fout). Bij succes: sla post op in `meta_page_posts`. Bij fout: return de error met status 400. |
| `supabase/functions/meta-api/index.ts` | `publish-post`: voeg logging toe zodat we het Graph API resultaat kunnen zien |
| `src/hooks/useMetaPagePosts.ts` | Voeg `.eq("company_id", companyId)` filter toe aan `postsQuery` |
| `src/hooks/useMetaPagePosts.ts` | `publishPost.onSuccess`: roep `fetchPosts.mutateAsync()` aan om bestaande posts van Facebook op te halen |

### Edge function `publish-post` actie (nieuw)
```
// Na graphPost:
console.log("publish-post result:", JSON.stringify(result));
if (result.error) {
  return jsonRes({ error: result.error.message || "Facebook error" }, 400);
}
// Sla op in meta_page_posts
await supabaseAdmin.from("meta_page_posts").insert({
  company_id: companyId,
  post_id: result.id,
  message: postMessage,
  created_time: new Date().toISOString(),
});
```

Dit lost twee dingen op:
- Posts worden opgeslagen en zijn zichtbaar in de app
- Fouten van Facebook worden doorgestuurd naar de frontend in plaats van stilzwijgend genegeerd

