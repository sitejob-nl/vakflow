import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function encrypt(plainText: string): Promise<string> {
  const keyHex = Deno.env.get("SMTP_ENCRYPTION_KEY");
  if (!keyHex) throw new Error("SMTP_ENCRYPTION_KEY not configured");

  let keyBytes: Uint8Array;
  if (keyHex.length === 64 && /^[0-9a-fA-F]+$/.test(keyHex)) {
    keyBytes = hexToBytes(keyHex);
  } else {
    try {
      const binary = atob(keyHex);
      keyBytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) keyBytes[i] = binary.charCodeAt(i);
      if (keyBytes.length !== 32) throw new Error("not 32 bytes");
    } catch {
      // Fallback: SHA-256 hash of the raw key string to get exactly 32 bytes
      keyBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(keyHex)));
    }
  }

  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plainText);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);

  return `${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(encrypted))}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state"); // contains company_id

    if (!code || !state) {
      return new Response("Missing code or state parameter", { status: 400 });
    }

    const clientId = Deno.env.get("OUTLOOK_CLIENT_ID");
    const tenantId = Deno.env.get("OUTLOOK_TENANT_ID") || "organizations";
    const clientSecret = Deno.env.get("OUTLOOK_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      return new Response("Outlook credentials not configured", { status: 500 });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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
        scope: "https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/Calendars.ReadWrite offline_access",
      }),
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      console.error("Token exchange error:", tokenData);
      return new Response(`OAuth error: ${tokenData.error_description}`, { status: 400 });
    }

    // Encrypt refresh token and save
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
      } as any)
      .eq("id", state);

    // Redirect back to settings page
    const appUrl = req.headers.get("origin") || req.headers.get("referer") || "";
    const baseUrl = appUrl ? new URL(appUrl).origin : "";
    
    return new Response(
      `<html><body><script>window.opener ? (window.opener.postMessage('outlook-connected','*'), window.close()) : (window.location.href = '${baseUrl}/settings')</script><p>Outlook gekoppeld! Je kunt dit venster sluiten.</p></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  } catch (error: any) {
    console.error("Outlook callback error:", error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
});
