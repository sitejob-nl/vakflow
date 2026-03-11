// exact-config — Webhook endpoint voor SiteJob Connect
// Ontvangt config updates (division, company_name) of disconnect acties
// Slaat nu op in exact_online_connections

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

    const admin = createAdminClient();

    // Look up connection by tenant_id
    const { data: connection } = await admin
      .from("exact_online_connections")
      .select("id, company_id, webhook_secret")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    if (!connection) {
      console.error("No exact_online_connections found for tenant_id:", tenant_id);
      return jsonRes({ error: "Unknown tenant" }, 404);
    }

    if (connection.webhook_secret !== webhookSecret) {
      console.error("Invalid webhook secret for tenant:", tenant_id);
      return jsonRes({ error: "Invalid secret" }, 403);
    }

    // Handle disconnect
    if (action === "disconnect") {
      await admin
        .from("exact_online_connections")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", connection.id);

      // Also reset exact_config status
      await admin
        .from("exact_config")
        .update({ status: "disconnected", updated_at: new Date().toISOString() })
        .eq("company_id", connection.company_id);

      console.log("Exact disconnected for company:", connection.company_id);
      return jsonRes({ ok: true });
    }

    // Update connection with division info (after successful OAuth)
    const updateData: Record<string, unknown> = {
      is_active: true,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (division !== undefined) updateData.exact_division = division;
    if (company_name !== undefined) updateData.company_name = company_name;
    if (region !== undefined) updateData.region = region;

    await admin
      .from("exact_online_connections")
      .update(updateData)
      .eq("id", connection.id);

    // Also update exact_config with connected status and division
    const configUpdate: Record<string, unknown> = {
      status: "connected",
      updated_at: new Date().toISOString(),
    };
    if (division !== undefined) configUpdate.division = division;
    if (company_name !== undefined) configUpdate.company_name_exact = company_name;
    if (region !== undefined) configUpdate.region = region;

    await admin
      .from("exact_config")
      .update(configUpdate)
      .eq("company_id", connection.company_id);

    console.log("Exact connection activated for company:", connection.company_id, "division:", division);
    return jsonRes({ ok: true });
  } catch (err: any) {
    console.error("exact-config error:", err);
    return jsonRes({ error: err.message || "Internal error" }, 500);
  }
});
