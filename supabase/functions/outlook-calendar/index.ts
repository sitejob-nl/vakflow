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
      scope: "https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/Calendars.ReadWrite offline_access",
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

    const { action, startDateTime, endDateTime, event, eventId } = await req.json();

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
      .select("outlook_refresh_token")
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

    const graphHeaders = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };

    let result: any;

    switch (action) {
      case "list": {
        if (!startDateTime || !endDateTime) {
          return new Response(JSON.stringify({ error: "startDateTime en endDateTime zijn verplicht" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const url = `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${encodeURIComponent(startDateTime)}&endDateTime=${encodeURIComponent(endDateTime)}&$orderby=start/dateTime&$top=200&$select=id,subject,start,end,location,bodyPreview,isAllDay,showAs,categories`;
        const res = await fetch(url, { headers: graphHeaders });
        if (!res.ok) {
          const errBody = await res.text();
          console.error("Graph calendarView error:", errBody);
          return new Response(JSON.stringify({ error: "Kan agenda niet ophalen", details: errBody }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const data = await res.json();
        result = data.value || [];
        break;
      }

      case "create": {
        if (!event) {
          return new Response(JSON.stringify({ error: "Event data is verplicht" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const res = await fetch("https://graph.microsoft.com/v1.0/me/events", {
          method: "POST",
          headers: graphHeaders,
          body: JSON.stringify(event),
        });
        if (!res.ok) {
          const errBody = await res.text();
          console.error("Graph create event error:", errBody);
          return new Response(JSON.stringify({ error: "Kan event niet aanmaken", details: errBody }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        result = await res.json();
        break;
      }

      case "update": {
        if (!eventId || !event) {
          return new Response(JSON.stringify({ error: "eventId en event data zijn verplicht" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const res = await fetch(`https://graph.microsoft.com/v1.0/me/events/${eventId}`, {
          method: "PATCH",
          headers: graphHeaders,
          body: JSON.stringify(event),
        });
        if (!res.ok) {
          const errBody = await res.text();
          console.error("Graph update event error:", errBody);
          return new Response(JSON.stringify({ error: "Kan event niet bijwerken", details: errBody }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        result = await res.json();
        break;
      }

      case "delete": {
        if (!eventId) {
          return new Response(JSON.stringify({ error: "eventId is verplicht" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const res = await fetch(`https://graph.microsoft.com/v1.0/me/events/${eventId}`, {
          method: "DELETE",
          headers: graphHeaders,
        });
        if (!res.ok) {
          const errBody = await res.text();
          console.error("Graph delete event error:", errBody);
          return new Response(JSON.stringify({ error: "Kan event niet verwijderen", details: errBody }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        result = { deleted: true };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "Ongeldige action. Gebruik: list, create, update, delete" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Outlook calendar error:", error);
    return new Response(
      JSON.stringify({ error: "Fout bij agenda-operatie", code: "OUTLOOK_CALENDAR_FAILED" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
