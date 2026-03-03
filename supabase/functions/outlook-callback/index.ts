import { corsHeaders } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { encrypt, hmacVerify } from "../_shared/crypto.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const rawState = url.searchParams.get("state");

    if (!code || !rawState) {
      return new Response("Missing code or state parameter", { status: 400 });
    }

    // Parse and verify HMAC-signed state: "companyId|appOrigin|hmac"
    const parts = rawState.split("|");
    if (parts.length < 3) {
      return new Response("Invalid state format", { status: 400 });
    }

    const hmac = parts.pop()!;
    const statePayload = parts.join("|");
    const isValid = await hmacVerify(statePayload, hmac);
    if (!isValid) {
      console.error("HMAC verification failed for state:", statePayload);
      return new Response("Invalid state signature", { status: 403 });
    }

    const [companyId, ...originParts] = parts;
    const appOrigin = originParts.join("|") || "https://app.vakflow.nl";

    const clientId = Deno.env.get("OUTLOOK_CLIENT_ID");
    const tenantId = Deno.env.get("OUTLOOK_TENANT_ID") || "organizations";
    const clientSecret = Deno.env.get("OUTLOOK_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      return new Response("Outlook credentials not configured", { status: 500 });
    }

    const supabaseAdmin = createAdminClient();

    // Exchange code for tokens
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/outlook-callback`;

    const tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        scope: "https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/Calendars.ReadWrite offline_access",
      }),
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      console.error("Token exchange error:", tokenData);
      return new Response(`OAuth error: ${tokenData.error_description}`, { status: 400 });
    }

    // Encrypt refresh token using shared crypto module
    const encryptedRefreshToken = await encrypt(tokenData.refresh_token);

    // Get user email from the access token (decode JWT payload)
    let outlookEmail = "";
    try {
      const payload = JSON.parse(atob(tokenData.access_token.split(".")[1]));
      outlookEmail = payload.upn || payload.unique_name || payload.preferred_username || "";
    } catch {
      outlookEmail = "";
    }

    await supabaseAdmin
      .from("companies")
      .update({
        outlook_refresh_token: encryptedRefreshToken,
        outlook_email: outlookEmail,
        email_provider: "outlook",
      } as any)
      .eq("id", companyId);

    const redirectUrl = `${appOrigin}/settings`;

    return new Response(
      `<html><body><script>window.opener ? (window.opener.postMessage('outlook-connected','*'), window.close()) : (window.location.href = '${redirectUrl}')</script><p>Outlook gekoppeld! Je kunt dit venster sluiten.</p></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  } catch (error: any) {
    console.error("Outlook callback error:", error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
});
