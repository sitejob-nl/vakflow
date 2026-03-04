import { jsonRes, optionsResponse } from "../_shared/cors.ts";
import { createAdminClient, authenticateRequest, AuthError } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  try {
    const { companyId } = await authenticateRequest(req);
    const supabaseAdmin = createAdminClient();

    // Check bestaande tenant voor DIT bedrijf
    const { data: existingConfig } = await supabaseAdmin
      .from("whatsapp_config")
      .select("tenant_id, phone_number_id")
      .eq("company_id", companyId)
      .maybeSingle();

    if (existingConfig?.tenant_id) {
      if (existingConfig.phone_number_id === 'pending') {
        // Previous registration never completed — delete stale row and re-register
        console.log("Stale pending config gevonden, verwijderen voor company:", companyId);
        await supabaseAdmin.from("whatsapp_config").delete().eq("company_id", companyId);
      } else {
        console.log("Bestaande tenant_id gevonden voor company:", companyId);
        return jsonRes({ tenant_id: existingConfig.tenant_id, existing: true });
      }
    }

    const body = await req.json();
    const { name, webhook_url } = body;

    if (!name || !webhook_url) {
      return jsonRes({ error: "name en webhook_url zijn verplicht" }, 400);
    }

    const connectApiKey = Deno.env.get("CONNECT_API_KEY");
    if (!connectApiKey) {
      return jsonRes({ error: "CONNECT_API_KEY is niet geconfigureerd" }, 500);
    }

    const registerRes = await fetch(
      "https://xeshjkznwdrxjjhbpisn.supabase.co/functions/v1/whatsapp-register-tenant",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": connectApiKey },
        body: JSON.stringify({ name, webhook_url }),
      }
    );

    if (!registerRes.ok) {
      const errorText = await registerRes.text();
      console.error("Register tenant failed:", registerRes.status, errorText);
      return jsonRes({ error: "Tenant registratie mislukt", code: "REGISTER_FAILED" }, registerRes.status);
    }

    const registerData = await registerRes.json();
    const { tenant_id, webhook_secret } = registerData;

    if (!tenant_id) {
      return jsonRes({ error: "Geen tenant_id ontvangen van Connect" }, 500);
    }

    // Upsert met company_id als scope
    const { error: upsertError } = await supabaseAdmin
      .from("whatsapp_config")
      .upsert(
        {
          company_id: companyId,
          phone_number_id: "pending",
          access_token: "pending",
          tenant_id,
          webhook_secret: webhook_secret || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "company_id" }
      );

    if (upsertError) {
      console.error("Upsert whatsapp_config failed:", upsertError);
      return jsonRes({ error: "Kon tenant_id niet opslaan" }, 500);
    }

    console.log("Tenant geregistreerd voor company:", companyId, "webhook_secret:", !!webhook_secret);
    return jsonRes({ tenant_id, webhook_secret: webhook_secret ? "ontvangen" : "bestaand" });
  } catch (err: any) {
    if (err instanceof AuthError) return jsonRes({ error: err.message }, err.status);
    console.error("whatsapp-register error:", err);
    return jsonRes({ error: err.message || "Internal error" }, 500);
  }
});
