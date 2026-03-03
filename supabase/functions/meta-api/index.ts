// meta-api/index.ts — GEFIXED: Graph API v25.0 (consistent met webhooks), shared imports

import { jsonRes, optionsResponse } from "../_shared/cors.ts";
import { createAdminClient, authenticateRequest, AuthError } from "../_shared/supabase.ts";

const GRAPH_API_VERSION = "v25.0"; // Consistent met webhook field versies

async function getConfig(supabase: any, companyId: string) {
  const { data, error } = await supabase
    .from("meta_config")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();
  if (error || !data) throw new Error("Meta config not found");
  return data;
}

async function graphGet(path: string, token: string) {
  const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

async function graphPost(path: string, token: string, body: any) {
  const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  try {
    // Authenticate via shared helper
    const { companyId } = await authenticateRequest(req);
    const supabaseAdmin = createAdminClient();

    const body = await req.json();
    const { action } = body;

    // ─── Status check ───
    if (action === "status") {
      const { data: config } = await supabaseAdmin
        .from("meta_config")
        .select("page_id, page_access_token, page_name")
        .eq("company_id", companyId)
        .maybeSingle();
      return jsonRes({
        connected: !!(config?.page_id && config?.page_access_token),
        page_id: config?.page_id || null,
        page_name: config?.page_name || null,
      });
    }

    // ─── Save config ───
    if (action === "save-config") {
      const { page_access_token, page_id, instagram_account_id, webhook_verify_token } = body;
      const updateData: any = {};
      if (page_access_token !== undefined) updateData.page_access_token = page_access_token || null;
      if (page_id !== undefined) updateData.page_id = page_id || null;
      if (instagram_account_id !== undefined) updateData.instagram_account_id = instagram_account_id || null;
      if (webhook_verify_token !== undefined) updateData.webhook_verify_token = webhook_verify_token || null;
      if (page_id === "" || page_id === null) updateData.page_name = null;

      const { error } = await supabaseAdmin.from("meta_config").upsert(
        { company_id: companyId, ...updateData },
        { onConflict: "company_id" }
      );
      if (error) return jsonRes({ error: error.message }, 500);
      return jsonRes({ success: true });
    }

    // ─── Get config ───
    if (action === "get-config") {
      const { data: config } = await supabaseAdmin
        .from("meta_config")
        .select("page_id, instagram_account_id, webhook_verify_token, page_access_token, page_name")
        .eq("company_id", companyId)
        .maybeSingle();

      return jsonRes({
        page_id: config?.page_id || null,
        page_name: config?.page_name || null,
        instagram_account_id: config?.instagram_account_id || null,
        webhook_verify_token: config?.webhook_verify_token || null,
        connected: !!(config?.page_id && config?.page_access_token),
      });
    }

    // ─── Fetch lead details from Meta ───
    if (action === "fetch-lead-details") {
      const { lead_id } = body;
      const config = await getConfig(supabaseAdmin, companyId);
      const result = await graphGet(
        `${lead_id}?fields=field_data,created_time,ad_id,form_id`,
        config.page_access_token
      );

      if (result.field_data) {
        await supabaseAdmin
          .from("meta_leads")
          .update({ customer_data: result })
          .eq("lead_id", lead_id)
          .eq("company_id", companyId);
      }
      return jsonRes(result);
    }

    // ─── Fetch leads from a form ───
    if (action === "fetch-form-leads") {
      const { form_id } = body;
      const config = await getConfig(supabaseAdmin, companyId);
      const result = await graphGet(
        `${form_id}/leads?fields=field_data,created_time`,
        config.page_access_token
      );
      return jsonRes(result);
    }

    // ─── Send message (Messenger or Instagram) ───
    if (action === "send-message") {
      const { recipient_id, message, platform } = body;
      const config = await getConfig(supabaseAdmin, companyId);

      const result = await graphPost(
        `${config.page_id}/messages`,
        config.page_access_token,
        {
          recipient: { id: recipient_id },
          message: { text: message },
          messaging_type: "RESPONSE",
        }
      );

      await supabaseAdmin.from("meta_conversations").insert({
        company_id: companyId,
        platform: platform || "messenger",
        sender_id: config.page_id,
        content: message,
        direction: "outgoing",
        message_id: result.message_id || null,
        metadata: result,
      });

      return jsonRes(result);
    }

    // ─── Fetch page posts ───
    if (action === "fetch-posts") {
      const config = await getConfig(supabaseAdmin, companyId);
      const result = await graphGet(
        `${config.page_id}/posts?fields=message,created_time,likes.summary(true),comments.summary(true),shares&limit=25`,
        config.page_access_token
      );

      if (result.data) {
        for (const post of result.data) {
          await supabaseAdmin.from("meta_page_posts").upsert(
            {
              company_id: companyId,
              post_id: post.id,
              message: post.message || null,
              created_time: post.created_time,
              likes: post.likes?.summary?.total_count || 0,
              comments: post.comments?.summary?.total_count || 0,
              shares: post.shares?.count || 0,
              metadata: post,
            },
            { onConflict: "post_id" }
          );
        }
      }

      return jsonRes(result);
    }

    // ─── Publish a post ───
    if (action === "publish-post") {
      const { message: postMessage } = body;
      const config = await getConfig(supabaseAdmin, companyId);
      const result = await graphPost(
        `${config.page_id}/feed`,
        config.page_access_token,
        { message: postMessage }
      );

      if (result.error) {
        return jsonRes({ error: result.error.message || "Facebook error", details: result.error }, 400);
      }

      await supabaseAdmin.from("meta_page_posts").insert({
        company_id: companyId,
        post_id: result.id,
        message: postMessage,
        created_time: new Date().toISOString(),
      });

      return jsonRes(result);
    }

    // ─── Page insights ───
    if (action === "page-insights") {
      const config = await getConfig(supabaseAdmin, companyId);
      const result = await graphGet(
        `${config.page_id}/insights?metric=page_impressions_unique,page_post_engagements,page_fans&period=day&date_preset=last_30d`,
        config.page_access_token
      );

      if (result.error) {
        console.warn("page-insights error:", JSON.stringify(result.error));
        return jsonRes({ data: [], error: result.error.message });
      }
      return jsonRes(result);
    }

    return jsonRes({ error: `Unknown action: ${action}` }, 400);
  } catch (err: any) {
    if (err instanceof AuthError) {
      return jsonRes({ error: err.message }, err.status);
    }
    console.error("meta-api error:", err);
    return jsonRes({ error: err.message || "Internal error" }, 500);
  }
});
