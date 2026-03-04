import { jsonRes, optionsResponse } from "../_shared/cors.ts";
import { createAdminClient, authenticateRequest, AuthError } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  try {
    const { companyId } = await authenticateRequest(req);
    const supabaseAdmin = createAdminClient();

    // Check existing config for this company
    const { data: existingConfig } = await supabaseAdmin
      .from("exact_config")
      .select("tenant_id, status")
      .eq("company_id", companyId)
      .maybeSingle();

    if (existingConfig?.tenant_id) {
      if (existingConfig.status === "pending") {
        // Previous registration never completed — delete stale row and re-register
        console.log("Stale pending exact config, deleting for company:", companyId);
        await supabaseAdmin.from("exact_config").delete().eq("company_id", companyId);
      } else {
        console.log("Existing exact tenant_id found for company:", companyId);
        return jsonRes({ tenant_id: existingConfig.tenant_id, existing: true });
      }
    }

    const connectApiKey = Deno.env.get("CONNECT_API_KEY");
    if (!connectApiKey) {
      return jsonRes({ error: "CONNECT_API_KEY is niet geconfigureerd" }, 500);
    }

    // Build unique webhook URL with company_id
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const webhookUrl = `${supabaseUrl}/functions/v1/exact-webhook?company_id=${companyId}`;

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
      return jsonRes({ error: "Exact tenant registratie mislukt", code: "REGISTER_FAILED" }, registerRes.status);
    }

    const registerData = await registerRes.json();
    const { tenant_id, webhook_secret } = registerData;

    if (!tenant_id) {
      return jsonRes({ error: "Geen tenant_id ontvangen van Connect" }, 500);
    }

    // Upsert config
    const { error: upsertError } = await supabaseAdmin
      .from("exact_config")
      .upsert(
        {
          company_id: companyId,
          tenant_id,
          webhook_secret: webhook_secret || null,
          status: "pending",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "company_id" }
      );

    if (upsertError) {
      console.error("Upsert exact_config failed:", upsertError);
      return jsonRes({ error: "Kon tenant_id niet opslaan" }, 500);
    }

    console.log("Exact tenant registered for company:", companyId);
    return jsonRes({ tenant_id });
  } catch (err: any) {
    if (err instanceof AuthError) return jsonRes({ error: err.message }, err.status);
    console.error("exact-register error:", err);
    return jsonRes({ error: err.message || "Internal error" }, 500);
  }
});
