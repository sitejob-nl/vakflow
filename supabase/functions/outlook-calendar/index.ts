import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decrypt } from "../_shared/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getAccessToken(refreshToken: string): Promise<string> {
  const clientId = Deno.env.get("OUTLOOK_CLIENT_ID");
  const tenantId = Deno.env.get("OUTLOOK_TENANT_ID") || "common";
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

async function getAccessTokenForUser(supabaseAdmin: any, userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("user_outlook_tokens")
    .select("outlook_refresh_token")
    .eq("user_id", userId)
    .single();

  if (!data?.outlook_refresh_token) return null;

  const refreshToken = await decrypt(data.outlook_refresh_token);
  return getAccessToken(refreshToken);
}

async function getAccessTokenForCompany(supabaseAdmin: any, companyId: string): Promise<string | null> {
  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("outlook_refresh_token")
    .eq("id", companyId)
    .single();

  if (!company?.outlook_refresh_token) return null;

  const refreshToken = await decrypt(company.outlook_refresh_token);
  return getAccessToken(refreshToken);
}

async function graphRequest(accessToken: string, method: string, url: string, body?: any): Promise<any> {
  const graphHeaders: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  const res = await fetch(url, {
    method,
    headers: graphHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (method === "DELETE") {
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Graph API error: ${errBody}`);
    }
    return { deleted: true };
  }

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Graph API error: ${errBody}`);
  }

  return res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonRes({ error: "Niet ingelogd" }, 401);
    }

    const body = await req.json();
    const { action, startDateTime, endDateTime, event, eventId, source, targetUserId } = body;

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
      return jsonRes({ error: "Ongeldige sessie" }, 401);
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!profile?.company_id) {
      return jsonRes({ error: "Geen bedrijf gevonden" }, 400);
    }

    const companyId = profile.company_id;

    // Determine which token source to use
    // source: "company" (default), "personal", "all", or "target_user" (for sync to specific user)
    const effectiveSource = source || "company";

    let result: any;

    switch (action) {
      case "list": {
        if (!startDateTime || !endDateTime) {
          return jsonRes({ error: "startDateTime en endDateTime zijn verplicht" }, 400);
        }

        const calendarUrl = `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${encodeURIComponent(startDateTime)}&endDateTime=${encodeURIComponent(endDateTime)}&$orderby=start/dateTime&$top=200&$select=id,subject,start,end,location,bodyPreview,isAllDay,showAs,categories`;

        if (effectiveSource === "all") {
          // Fetch from both company and personal tokens, merge results
          const results: any[] = [];

          // Company events
          try {
            const companyToken = await getAccessTokenForCompany(supabaseAdmin, companyId);
            if (companyToken) {
              const data = await graphRequest(companyToken, "GET", calendarUrl);
              (data.value || []).forEach((ev: any) => {
                ev._source = "company";
                results.push(ev);
              });
            }
          } catch (e) {
            console.error("Company calendar fetch error:", e);
          }

          // Personal events
          try {
            const personalToken = await getAccessTokenForUser(supabaseAdmin, user.id);
            if (personalToken) {
              const data = await graphRequest(personalToken, "GET", calendarUrl);
              (data.value || []).forEach((ev: any) => {
                ev._source = "personal";
                results.push(ev);
              });
            }
          } catch (e) {
            console.error("Personal calendar fetch error:", e);
          }

          result = results;
        } else if (effectiveSource === "personal") {
          const personalToken = await getAccessTokenForUser(supabaseAdmin, user.id);
          if (!personalToken) {
            return jsonRes({ error: "Geen persoonlijke Outlook gekoppeld" }, 400);
          }
          const data = await graphRequest(personalToken, "GET", calendarUrl);
          result = (data.value || []).map((ev: any) => ({ ...ev, _source: "personal" }));
        } else {
          // company (default)
          const companyToken = await getAccessTokenForCompany(supabaseAdmin, companyId);
          if (!companyToken) {
            return jsonRes({ error: "Outlook niet geconfigureerd" }, 400);
          }
          const data = await graphRequest(companyToken, "GET", calendarUrl);
          result = (data.value || []).map((ev: any) => ({ ...ev, _source: "company" }));
        }
        break;
      }

      case "create": {
        if (!event) {
          return jsonRes({ error: "Event data is verplicht" }, 400);
        }

        // Determine whose calendar to create in
        const createUserId = targetUserId || user.id;
        let accessToken: string | null = null;

        // Try personal token of target user first
        accessToken = await getAccessTokenForUser(supabaseAdmin, createUserId);

        // Fallback to company token if no personal token
        if (!accessToken) {
          accessToken = await getAccessTokenForCompany(supabaseAdmin, companyId);
        }

        if (!accessToken) {
          return jsonRes({ error: "Geen Outlook token beschikbaar voor deze gebruiker" }, 400);
        }

        result = await graphRequest(accessToken, "POST", "https://graph.microsoft.com/v1.0/me/events", event);
        break;
      }

      case "update": {
        if (!eventId || !event) {
          return jsonRes({ error: "eventId en event data zijn verplicht" }, 400);
        }

        const updateUserId = targetUserId || user.id;
        let accessToken = await getAccessTokenForUser(supabaseAdmin, updateUserId);
        if (!accessToken) accessToken = await getAccessTokenForCompany(supabaseAdmin, companyId);
        if (!accessToken) return jsonRes({ error: "Geen Outlook token" }, 400);

        result = await graphRequest(accessToken, "PATCH", `https://graph.microsoft.com/v1.0/me/events/${eventId}`, event);
        break;
      }

      case "delete": {
        if (!eventId) {
          return jsonRes({ error: "eventId is verplicht" }, 400);
        }

        const deleteUserId = targetUserId || user.id;
        let accessToken = await getAccessTokenForUser(supabaseAdmin, deleteUserId);
        if (!accessToken) accessToken = await getAccessTokenForCompany(supabaseAdmin, companyId);
        if (!accessToken) return jsonRes({ error: "Geen Outlook token" }, 400);

        result = await graphRequest(accessToken, "DELETE", `https://graph.microsoft.com/v1.0/me/events/${eventId}`);
        break;
      }

      case "check_user_token": {
        // Check if a specific user has a personal Outlook token
        const checkUserId = targetUserId || user.id;
        const { data: tokenData } = await supabaseAdmin
          .from("user_outlook_tokens")
          .select("outlook_email")
          .eq("user_id", checkUserId)
          .single();

        result = {
          has_token: !!tokenData,
          outlook_email: tokenData?.outlook_email || null,
        };
        break;
      }

      default:
        return jsonRes({ error: "Ongeldige action. Gebruik: list, create, update, delete, check_user_token" }, 400);
    }

    return jsonRes(result);
  } catch (error: any) {
    console.error("Outlook calendar error:", error);
    return jsonRes({ error: error.message || "Fout bij agenda-operatie", code: "OUTLOOK_CALENDAR_FAILED" }, 500);
  }
});
