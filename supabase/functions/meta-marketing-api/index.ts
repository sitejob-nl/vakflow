// meta-marketing-api — Proxy voor Meta Graph API calls met verse tokens via SiteJob Connect

import { jsonRes, optionsResponse } from "../_shared/cors.ts";
import { createAdminClient, authenticateRequest, AuthError } from "../_shared/supabase.ts";
import { getMetaMarketingToken } from "../_shared/meta-marketing-connect.ts";

const GRAPH_BASE = "https://graph.facebook.com/v25.0";

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

    if (!config?.tenant_id || !config?.webhook_secret) {
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
      });
    }

    if (!config.is_connected) {
      return jsonRes({ error: "Meta Marketing is nog niet gekoppeld" }, 400);
    }

    // Get fresh token
    let token;
    try {
      token = await getMetaMarketingToken({
        tenant_id: config.tenant_id,
        webhook_secret: config.webhook_secret,
      });
    } catch (err: any) {
      if (err.needs_reauth) {
        return jsonRes({ error: err.message, needs_reauth: true }, 401);
      }
      throw err;
    }

    let url: string;
    let fetchOpts: RequestInit = {
      headers: { Accept: "application/json" },
    };

    switch (action) {
      case "campaigns": {
        const adAccountId = config.ad_account_id || token.ad_account_id;
        if (!adAccountId) return jsonRes({ error: "Geen ad account gekoppeld" }, 400);
        url = `${GRAPH_BASE}/${adAccountId}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time&access_token=${token.user_access_token}`;
        break;
      }

      case "adsets": {
        const adAccountId = config.ad_account_id || token.ad_account_id;
        if (!adAccountId) return jsonRes({ error: "Geen ad account gekoppeld" }, 400);
        url = `${GRAPH_BASE}/${adAccountId}/adsets?fields=id,name,status,targeting,bid_amount,daily_budget&access_token=${token.user_access_token}`;
        break;
      }

      case "ads": {
        const adAccountId = config.ad_account_id || token.ad_account_id;
        if (!adAccountId) return jsonRes({ error: "Geen ad account gekoppeld" }, 400);
        url = `${GRAPH_BASE}/${adAccountId}/ads?fields=id,name,status,creative&access_token=${token.user_access_token}`;
        break;
      }

      case "insights": {
        const adAccountId = config.ad_account_id || token.ad_account_id;
        if (!adAccountId) return jsonRes({ error: "Geen ad account gekoppeld" }, 400);
        const datePreset = params.date_preset || "last_30d";
        url = `${GRAPH_BASE}/${adAccountId}/insights?fields=impressions,clicks,spend,cpc,ctr,reach,frequency,actions&date_preset=${datePreset}&access_token=${token.user_access_token}`;
        break;
      }

      case "page-posts": {
        const pageId = config.page_id || token.page_id;
        if (!pageId) return jsonRes({ error: "Geen pagina gekoppeld" }, 400);
        const pageToken = token.page_access_token || token.user_access_token;
        url = `${GRAPH_BASE}/${pageId}/posts?fields=id,message,created_time,shares,likes.summary(true),comments.summary(true)&access_token=${pageToken}`;
        break;
      }

      case "publish-post": {
        const pageId = config.page_id || token.page_id;
        if (!pageId) return jsonRes({ error: "Geen pagina gekoppeld" }, 400);
        const pageToken = token.page_access_token || token.user_access_token;
        url = `${GRAPH_BASE}/${pageId}/feed`;
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
        const igId = config.instagram_id || token.instagram_id;
        if (!igId) return jsonRes({ error: "Geen Instagram account gekoppeld" }, 400);
        url = `${GRAPH_BASE}/${igId}/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count&access_token=${token.user_access_token}`;
        break;
      }

      case "instagram-insights": {
        const igId = config.instagram_id || token.instagram_id;
        if (!igId) return jsonRes({ error: "Geen Instagram account gekoppeld" }, 400);
        url = `${GRAPH_BASE}/${igId}/insights?metric=impressions,reach,profile_views&period=day&access_token=${token.user_access_token}`;
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
