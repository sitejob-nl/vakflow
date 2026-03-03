import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  return bytes;
}

async function decrypt(encryptedStr: string): Promise<string> {
  const keyHex = Deno.env.get("SMTP_ENCRYPTION_KEY");
  if (!keyHex) throw new Error("SMTP_ENCRYPTION_KEY not configured");

  let keyBytes: Uint8Array;
  if (keyHex.length === 64 && /^[0-9a-fA-F]+$/.test(keyHex)) {
    keyBytes = hexToBytes(keyHex);
  } else {
    keyBytes = base64ToBytes(keyHex);
  }

  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]);
  const [ivB64, ctB64] = encryptedStr.split(":");
  const iv = base64ToBytes(ivB64);
  const ciphertext = base64ToBytes(ctB64);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}

async function getAccessToken(refreshToken: string): Promise<string> {
  const clientId = Deno.env.get("OUTLOOK_CLIENT_ID");
  const tenantId = Deno.env.get("OUTLOOK_TENANT_ID") || "organizations";
  const clientSecret = Deno.env.get("OUTLOOK_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Outlook credentials not configured");

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      scope: "https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/Calendars.ReadWrite offline_access",
    }),
  });

  const data = await res.json();
  if (data.error) throw new Error(`Token refresh failed: ${data.error_description}`);
  return data.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Niet ingelogd" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { to, subject, body, html, attachments } = await req.json();

    if (!to || !subject || !body) {
      return new Response(JSON.stringify({ error: "Verplichte velden ontbreken" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Ongeldige sessie" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!profile?.company_id) {
      return new Response(JSON.stringify({ error: "Geen bedrijf gevonden" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("outlook_refresh_token, outlook_email")
      .eq("id", profile.company_id)
      .single();

    if (!company?.outlook_refresh_token) {
      return new Response(JSON.stringify({ error: "Outlook niet geconfigureerd" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const refreshToken = await decrypt(company.outlook_refresh_token);
    const accessToken = await getAccessToken(refreshToken);

    // Build Graph API email payload
    const toAddresses = to.split(",").map((e: string) => ({
      emailAddress: { address: e.trim() },
    }));

    const message: any = {
      subject,
      body: {
        contentType: html ? "HTML" : "Text",
        content: html || body,
      },
      toRecipients: toAddresses,
    };

    if (attachments && Array.isArray(attachments)) {
      message.attachments = attachments.map((att: any) => ({
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: att.filename,
        contentType: att.contentType || "application/octet-stream",
        contentBytes: att.content,
      }));
    }

    const graphRes = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message, saveToSentItems: true }),
    });

    if (!graphRes.ok) {
      const errBody = await graphRes.text();
      console.error("Graph API error:", errBody);
      return new Response(
        JSON.stringify({ error: "Outlook verzending mislukt", details: errBody }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Outlook send error:", error);
    return new Response(
      JSON.stringify({ error: "Fout bij het versturen via Outlook", code: "OUTLOOK_SEND_FAILED" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
