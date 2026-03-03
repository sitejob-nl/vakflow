import { corsHeaders, jsonRes, optionsResponse } from "../_shared/cors.ts";
import { authenticateRequest, AuthError, createAdminClient } from "../_shared/supabase.ts";
import { hmacSign } from "../_shared/crypto.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  try {
    const { userId, companyId } = await authenticateRequest(req);

    // Parse optional body for scope (company or personal)
    let scope = "company";
    try {
      const body = await req.json();
      if (body?.scope === "personal") scope = "personal";
    } catch { /* no body = default company scope */ }

    const clientId = Deno.env.get("OUTLOOK_CLIENT_ID");
    const tenantId = Deno.env.get("OUTLOOK_TENANT_ID") || "common";

    if (!clientId) {
      return jsonRes({ error: "OUTLOOK_CLIENT_ID niet geconfigureerd" }, 500);
    }

    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/outlook-callback`;
    const oauthScope = "https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/Calendars.ReadWrite offline_access";

    // HMAC-sign the state to prevent tampering
    // Format: scope|companyId|userId|appOrigin
    const statePayload = `${scope}|${companyId}|${userId}|https://app.vakflow.nl`;
    const sig = await hmacSign(statePayload);
    const stateParam = `${statePayload}|${sig}`;

    const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?client_id=${encodeURIComponent(clientId)}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(oauthScope)}&state=${encodeURIComponent(stateParam)}&response_mode=query`;

    return jsonRes({ url: authUrl });
  } catch (err: any) {
    if (err instanceof AuthError) return jsonRes({ error: err.message }, err.status);
    console.error("Outlook auth URL error:", err);
    return jsonRes({ error: "Fout bij het genereren van de auth URL" }, 500);
  }
});
