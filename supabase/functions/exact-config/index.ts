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
    const { tenant_id, division, company_name, region, action } = body;

    if (!tenant_id) {
      return jsonRes({ error: "tenant_id is required" }, 400);
    }

    const supabaseAdmin = createAdminClient();

    // Look up config by tenant_id and verify webhook_secret
    const { data: config } = await supabaseAdmin
      .from("exact_config")
      .select("id, company_id, webhook_secret")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    if (!config) {
      console.error("No exact_config found for tenant_id:", tenant_id);
      return jsonRes({ error: "Unknown tenant" }, 404);
    }

    if (config.webhook_secret !== webhookSecret) {
      console.error("Invalid webhook secret for tenant:", tenant_id);
      return jsonRes({ error: "Invalid secret" }, 403);
    }

    // Handle disconnect
    if (action === "disconnect") {
      await supabaseAdmin
        .from("exact_config")
        .update({ status: "disconnected", division: null, company_name_exact: null, updated_at: new Date().toISOString() })
        .eq("id", config.id);
      console.log("Exact disconnected for company:", config.company_id);
      return jsonRes({ ok: true });
    }

    // Update config with division info
    const updateData: Record<string, unknown> = {
      status: "connected",
      updated_at: new Date().toISOString(),
    };
    if (division !== undefined) updateData.division = division;
    if (company_name !== undefined) updateData.company_name_exact = company_name;
    if (region !== undefined) updateData.region = region;

    await supabaseAdmin
      .from("exact_config")
      .update(updateData)
      .eq("id", config.id);

    console.log("Exact config updated for company:", config.company_id, "division:", division);
    return jsonRes({ ok: true });
  } catch (err: any) {
    console.error("exact-config error:", err);
    return jsonRes({ error: err.message || "Internal error" }, 500);
  }
});
