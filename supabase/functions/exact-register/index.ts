// exact-register — Registreer een Exact Online tenant via SiteJob Connect
// Slaat nu op in exact_online_connections i.p.v. exact_config

import { jsonRes, optionsResponse } from "../_shared/cors.ts";
import { createAdminClient, authenticateRequest, AuthError } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);

  try {
    const { companyId } = await authenticateRequest(req);
    const admin = createAdminClient();

    // Check existing connection
    const { data: existing } = await admin
      .from("exact_online_connections")
      .select("id, tenant_id, is_active, division_id")
      .eq("company_id", companyId)
      .maybeSingle();

    if (existing?.tenant_id && existing.is_active) {
      return jsonRes({ tenant_id: existing.tenant_id, existing: true });
    }

    // If there's an inactive connection, delete it to re-register
    if (existing) {
      await admin.from("exact_online_connections").delete().eq("id", existing.id);
    }

    const connectApiKey = Deno.env.get("CONNECT_API_KEY");
    if (!connectApiKey) {
      return jsonRes({ error: "CONNECT_API_KEY is niet geconfigureerd" }, 500);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const webhookUrl = `${supabaseUrl}/functions/v1/exact-config`;

    const registerRes = await fetch(
      "https://xeshjkznwdrxjjhbpisn.supabase.co/functions/v1/exact-register-tenant",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": connectApiKey },
        body: JSON.stringify({ name: `Vakflow-${companyId}`, webhook_url: webhookUrl, region: "nl" }),
      }
    );

    if (!registerRes.ok) {
      const errorText = await registerRes.text();
      console.error("Register exact tenant failed:", registerRes.status, errorText);
      return jsonRes({ error: "Exact tenant registratie mislukt" }, registerRes.status);
    }

    const registerData = await registerRes.json();
    const { tenant_id, webhook_secret } = registerData;

    if (!tenant_id) {
      return jsonRes({ error: "Geen tenant_id ontvangen van Connect" }, 500);
    }

    // Insert new connection
    const { error: insertError } = await admin
      .from("exact_online_connections")
      .insert({
        company_id: companyId,
        division_id: tenant_id, // Use tenant_id as division_id initially
        tenant_id,
        webhook_secret: webhook_secret || null,
        is_active: false, // Will be activated via webhook after OAuth
        region: "nl",
      });

    if (insertError) {
      console.error("Insert exact_online_connections failed:", insertError);
      return jsonRes({ error: "Kon verbinding niet opslaan" }, 500);
    }

    // Also create exact_config row so the settings UI shows the pending state
    const { error: configError } = await admin
      .from("exact_config")
      .upsert({
        company_id: companyId,
        tenant_id,
        webhook_secret: webhook_secret || null,
        status: "pending",
      }, { onConflict: "company_id" });

    if (configError) {
      console.error("Upsert exact_config failed:", configError);
      // Non-fatal — connection still works, config can be created later
    }

    console.log("Exact tenant registered for company:", companyId);
    return jsonRes({ tenant_id });
  } catch (err: any) {
    if (err instanceof AuthError) return jsonRes({ error: err.message }, err.status);
    console.error("exact-register error:", err);
    return jsonRes({ error: err.message || "Internal error" }, 500);
  }
});
