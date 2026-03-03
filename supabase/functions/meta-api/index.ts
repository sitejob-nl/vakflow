import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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
  const res = await fetch(`https://graph.facebook.com/v21.0/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

async function graphPost(path: string, token: string, body: any) {
  const res = await fetch(`https://graph.facebook.com/v21.0/${path}`, {
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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonRes({ error: "Unauthorized" }, 401);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabaseUser.auth.getClaims(token);
    if (claimsErr || !claims?.claims) return jsonRes({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .single();
    if (!profile?.company_id) return jsonRes({ error: "No company" }, 400);
    const companyId = profile.company_id;

    const body = await req.json();
    const { action } = body;

    // Status check
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

    // Save config (simplified — only page-level fields)
    if (action === "save-config") {
      const { page_access_token, page_id, instagram_account_id, webhook_verify_token } = body;
      const updateData: any = {};
      if (page_access_token !== undefined) updateData.page_access_token = page_access_token || null;
      if (page_id !== undefined) updateData.page_id = page_id || null;
      if (instagram_account_id !== undefined) updateData.instagram_account_id = instagram_account_id || null;
      if (webhook_verify_token !== undefined) updateData.webhook_verify_token = webhook_verify_token || null;
      // Clear page_name when disconnecting
      if (page_id === "" || page_id === null) updateData.page_name = null;

      const { error } = await supabaseAdmin.from("meta_config").upsert(
        { company_id: companyId, ...updateData },
        { onConflict: "company_id" }
      );
      if (error) return jsonRes({ error: error.message }, 500);
      return jsonRes({ success: true });
    }

    // Get config (for settings page)
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

    // Fetch lead details from Meta
    if (action === "fetch-lead-details") {
      const { lead_id } = body;
      const config = await getConfig(supabaseAdmin, companyId);
      const result = await graphGet(`${lead_id}?fields=field_data,created_time,ad_id,form_id`, config.page_access_token);
      
      if (result.field_data) {
        await supabaseAdmin
          .from("meta_leads")
          .update({ customer_data: result })
          .eq("lead_id", lead_id)
          .eq("company_id", companyId);
      }
      return jsonRes(result);
    }

    // Fetch leads from a form
    if (action === "fetch-form-leads") {
      const { form_id } = body;
      const config = await getConfig(supabaseAdmin, companyId);
      const result = await graphGet(`${form_id}/leads?fields=field_data,created_time`, config.page_access_token);
      return jsonRes(result);
    }

    // Send message (Messenger or Instagram)
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

    // Fetch page posts
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

    // Publish a post
    if (action === "publish-post") {
      const { message: postMessage } = body;
      const config = await getConfig(supabaseAdmin, companyId);
      const result = await graphPost(`${config.page_id}/feed`, config.page_access_token, {
        message: postMessage,
      });
      console.log("publish-post result:", JSON.stringify(result));
      if (result.error) {
        return jsonRes({ error: result.error.message || "Facebook error", details: result.error }, 400);
      }
      // Save post locally
      await supabaseAdmin.from("meta_page_posts").insert({
        company_id: companyId,
        post_id: result.id,
        message: postMessage,
        created_time: new Date().toISOString(),
      });
      return jsonRes(result);
    }

    // Page insights
    if (action === "page-insights") {
      const config = await getConfig(supabaseAdmin, companyId);
      const result = await graphGet(
        `${config.page_id}/insights?metric=page_impressions,page_engaged_users,page_fans&period=day&date_preset=last_30d`,
        config.page_access_token
      );
      return jsonRes(result);
    }

    return jsonRes({ error: `Unknown action: ${action}` }, 400);
  } catch (err: any) {
    console.error("meta-api error:", err);
    return jsonRes({ error: err.message || "Internal error" }, 500);
  }
});
