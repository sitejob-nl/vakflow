// meta-marketing-config — Ontvangt config push van SiteJob Connect na OAuth
// Verificatie via X-Webhook-Secret header

import { jsonRes, optionsResponse } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  try {
    const webhookSecret = req.headers.get("x-webhook-secret");
    if (!webhookSecret) {
      return jsonRes({ error: "Missing webhook secret" }, 401);
    }

    const body = await req.json();
    const { tenant_id, action } = body;

    if (!tenant_id) {
      return jsonRes({ error: "tenant_id is required" }, 400);
    }

    const admin = createAdminClient();

    // Look up config by tenant_id
    const { data: config } = await admin
      .from("meta_marketing_config")
      .select("id, company_id, webhook_secret")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    if (!config) {
      console.error("No meta_marketing_config found for tenant_id:", tenant_id);
      return jsonRes({ error: "Unknown tenant" }, 404);
    }

    if (config.webhook_secret !== webhookSecret) {
      console.error("Invalid webhook secret for meta-marketing tenant:", tenant_id);
      return jsonRes({ error: "Invalid secret" }, 403);
    }

    // Handle disconnect
    if (action === "disconnect") {
      await admin
        .from("meta_marketing_config")
        .update({
          is_connected: false,
          ad_account_id: null,
          ad_account_name: null,
          page_id: null,
          page_name: null,
          instagram_id: null,
          instagram_username: null,
          granted_scopes: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", config.id);

      console.log("Meta Marketing disconnected for company:", config.company_id);
      return jsonRes({ ok: true });
    }

    // Update config with connected account details
    const {
      ad_account_id,
      ad_account_name,
      page_id,
      page_name,
      instagram_id,
      instagram_username,
      granted_scopes,
    } = body;

    await admin
      .from("meta_marketing_config")
      .update({
        is_connected: true,
        ad_account_id: ad_account_id || null,
        ad_account_name: ad_account_name || null,
        page_id: page_id || null,
        page_name: page_name || null,
        instagram_id: instagram_id || null,
        instagram_username: instagram_username || null,
        granted_scopes: granted_scopes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", config.id);

    console.log("Meta Marketing connected for company:", config.company_id, "ad_account:", ad_account_id, "page:", page_id);
    return jsonRes({ ok: true });
  } catch (err: any) {
    console.error("meta-marketing-config error:", err);
    return jsonRes({ error: err.message || "Internal error" }, 500);
  }
});
