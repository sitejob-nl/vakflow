// meta-marketing-register — Registreer een Meta Marketing tenant via SiteJob Connect (push-model)

import { jsonRes, optionsResponse } from "../_shared/cors.ts";
import { createAdminClient, authenticateRequest, AuthError } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);

  try {
    const { companyId } = await authenticateRequest(req);
    const admin = createAdminClient();

    // Check existing config
    const { data: existing } = await admin
      .from("meta_marketing_config")
      .select("id, tenant_id, is_connected, connect_url")
      .eq("company_id", companyId)
      .maybeSingle();

    if (existing?.tenant_id && existing.is_connected) {
      return jsonRes({
        tenant_id: existing.tenant_id,
        connect_url: existing.connect_url,
        existing: true,
      });
    }

    // Delete inactive config to re-register
    if (existing) {
      await admin.from("meta_marketing_config").delete().eq("id", existing.id);
    }

    const connectApiKey = Deno.env.get("CONNECT_API_KEY");
    if (!connectApiKey) {
      return jsonRes({ error: "CONNECT_API_KEY is niet geconfigureerd" }, 500);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const webhookUrl = `${supabaseUrl}/functions/v1/connect-meta-webhook`;

    const registerRes = await fetch(
      "https://xeshjkznwdrxjjhbpisn.supabase.co/functions/v1/meta-marketing-register-tenant",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": connectApiKey },
        body: JSON.stringify({ name: `Vakflow-${companyId}`, webhook_url: webhookUrl }),
      }
    );

    if (!registerRes.ok) {
      const errorText = await registerRes.text();
      console.error("Register meta-marketing tenant failed:", registerRes.status, errorText);
      return jsonRes({ error: "Meta Marketing tenant registratie mislukt" }, registerRes.status);
    }

    const registerData = await registerRes.json();

    // New response format: { success, tenant: { id, webhook_secret, connect_url, ... } }
    const tenant = registerData.tenant || registerData;
    const tenantId = tenant.id || tenant.tenant_id;
    const webhookSecret = tenant.webhook_secret;
    const connectUrl = tenant.connect_url || null;

    if (!tenantId) {
      return jsonRes({ error: "Geen tenant_id ontvangen van Connect" }, 500);
    }

    // Insert new config
    const { error: insertError } = await admin
      .from("meta_marketing_config")
      .insert({
        company_id: companyId,
        tenant_id: tenantId,
        webhook_secret: webhookSecret || null,
        connect_url: connectUrl,
        is_connected: false,
      });

    if (insertError) {
      console.error("Insert meta_marketing_config failed:", insertError);
      return jsonRes({ error: "Kon configuratie niet opslaan" }, 500);
    }

    console.log("Meta Marketing tenant registered for company:", companyId);
    return jsonRes({ tenant_id: tenantId, connect_url: connectUrl });
  } catch (err: any) {
    if (err instanceof AuthError) return jsonRes({ error: err.message }, err.status);
    console.error("meta-marketing-register error:", err);
    return jsonRes({ error: err.message || "Internal error" }, 500);
  }
});
