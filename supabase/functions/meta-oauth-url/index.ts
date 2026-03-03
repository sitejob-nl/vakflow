import { corsHeaders, jsonRes, optionsResponse } from "../_shared/cors.ts";
import { createAdminClient, authenticateRequest, AuthError } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  try {
    const { userId, companyId } = await authenticateRequest(req);

    const { redirect_uri } = await req.json();
    const appId = Deno.env.get("META_APP_ID");
    if (!appId) {
      return jsonRes({ error: "META_APP_ID not configured" }, 500);
    }

    const scopes = [
      "pages_manage_metadata",
      "pages_messaging",
      "leads_retrieval",
      "instagram_manage_messages",
      "pages_read_engagement",
      "pages_manage_posts",
    ].join(",");

    const state = btoa(JSON.stringify({ company_id: companyId, user_id: userId }));

    const url = `https://www.facebook.com/v25.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirect_uri)}&scope=${scopes}&state=${encodeURIComponent(state)}&response_type=code`;

    return jsonRes({ url });
  } catch (err: any) {
    if (err instanceof AuthError) return jsonRes({ error: err.message }, err.status);
    console.error("meta-oauth-url error:", err);
    return jsonRes({ error: err.message }, 500);
  }
});