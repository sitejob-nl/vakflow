// meta-marketing-api — Meta Graph API calls met lokaal opgeslagen tokens (push-model)

import { jsonRes, optionsResponse } from "../_shared/cors.ts";
import { createAdminClient, authenticateRequest, AuthError } from "../_shared/supabase.ts";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);

  try {
    const { companyId } = await authenticateRequest(req);
    const admin = createAdminClient();

    const { data: config } = await admin
      .from("meta_marketing_config")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();

    if (!config?.tenant_id) {
      return jsonRes({ error: "Meta Marketing is niet geconfigureerd" }, 400);
    }

    const body = await req.json();
    const { action, ...params } = body;

    // Status check — no token needed
    if (action === "status") {
      return jsonRes({
        connected: config.is_connected,
        ad_account_id: config.ad_account_id,
        ad_account_name: config.ad_account_name,
        page_id: config.page_id,
        page_name: config.page_name,
        instagram_id: config.instagram_id,
        instagram_username: config.instagram_username,
        tenant_id: config.tenant_id,
        connect_url: config.connect_url,
      });
    }

    if (!config.is_connected) {
      return jsonRes({ error: "Meta Marketing is nog niet gekoppeld" }, 400);
    }

    // Check token availability and expiry
    if (!config.user_access_token) {
      return jsonRes({ error: "Geen access token beschikbaar — herautenticatie nodig", needs_reauth: true }, 401);
    }

    if (config.token_expires_at && new Date(config.token_expires_at) < new Date()) {
      return jsonRes({ error: "Token verlopen — SiteJob Connect refresht automatisch, probeer later opnieuw", needs_reauth: true }, 401);
    }

    const userToken = config.user_access_token;
    const pageToken = config.page_access_token || config.user_access_token;

    let url: string;
    let fetchOpts: RequestInit = {
      headers: { Accept: "application/json" },
    };

    switch (action) {
      case "campaigns": {
        if (!config.ad_account_id) return jsonRes({ error: "Geen ad account gekoppeld" }, 400);
        url = `${GRAPH_BASE}/${config.ad_account_id}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time&access_token=${userToken}`;
        break;
      }

      case "adsets": {
        if (!config.ad_account_id) return jsonRes({ error: "Geen ad account gekoppeld" }, 400);
        url = `${GRAPH_BASE}/${config.ad_account_id}/adsets?fields=id,name,status,targeting,bid_amount,daily_budget&access_token=${userToken}`;
        break;
      }

      case "ads": {
        if (!config.ad_account_id) return jsonRes({ error: "Geen ad account gekoppeld" }, 400);
        url = `${GRAPH_BASE}/${config.ad_account_id}/ads?fields=id,name,status,creative&access_token=${userToken}`;
        break;
      }

      case "insights": {
        if (!config.ad_account_id) return jsonRes({ error: "Geen ad account gekoppeld" }, 400);
        const datePreset = params.date_preset || "last_30d";
        url = `${GRAPH_BASE}/${config.ad_account_id}/insights?fields=impressions,clicks,spend,cpc,ctr,reach,frequency,actions&date_preset=${datePreset}&access_token=${userToken}`;
        break;
      }

      case "page-posts": {
        if (!config.page_id) return jsonRes({ error: "Geen pagina gekoppeld" }, 400);
        url = `${GRAPH_BASE}/${config.page_id}/posts?fields=id,message,created_time,shares,likes.summary(true),comments.summary(true)&access_token=${pageToken}`;
        break;
      }

      case "publish-post": {
        if (!config.page_id) return jsonRes({ error: "Geen pagina gekoppeld" }, 400);
        url = `${GRAPH_BASE}/${config.page_id}/feed`;
        fetchOpts = {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: params.message,
            access_token: pageToken,
          }),
        };
        break;
      }

      case "instagram-media": {
        if (!config.instagram_id) return jsonRes({ error: "Geen Instagram account gekoppeld" }, 400);
        url = `${GRAPH_BASE}/${config.instagram_id}/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count&access_token=${userToken}`;
        break;
      }

      case "instagram-insights": {
        if (!config.instagram_id) return jsonRes({ error: "Geen Instagram account gekoppeld" }, 400);
        url = `${GRAPH_BASE}/${config.instagram_id}/insights?metric=impressions,reach,profile_views&period=day&access_token=${userToken}`;
        break;
      }

      default:
        return jsonRes({ error: `Onbekende actie: ${action}` }, 400);
    }

    const graphRes = await fetch(url, fetchOpts);
    const graphData = await graphRes.json();

    if (!graphRes.ok) {
      console.error("Meta Graph API error:", graphRes.status, JSON.stringify(graphData));
      return jsonRes({ error: graphData.error?.message || "Graph API error", graph_error: graphData.error }, graphRes.status);
    }

    return jsonRes(graphData, 200, req);
  } catch (err: any) {
    if (err instanceof AuthError) return jsonRes({ error: err.message }, err.status);
    console.error("meta-marketing-api error:", err);
    return jsonRes({ error: err.message || "Internal error" }, 500);
  }
});
