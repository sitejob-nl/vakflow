import { corsHeaders, jsonRes, optionsResponse } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const supabase = createAdminClient();

  // Read the incoming secret from header
  const incomingSecret = req.headers.get("X-Webhook-Secret");
  console.log("whatsapp-config called, has X-Webhook-Secret:", !!incomingSecret);

  // Verify against stored webhook_secret (fallback to env var)
  const { data: existingConfig } = await supabase
    .from("whatsapp_config")
    .select("webhook_secret")
    .limit(1)
    .maybeSingle();

  const storedSecret = existingConfig?.webhook_secret || Deno.env.get("WHATSAPP_WEBHOOK_SECRET");

  if (!storedSecret) {
    console.error("Geen webhook_secret gevonden in database of env var");
    return new Response("Server misconfigured", { status: 500, headers: corsHeaders });
  }

  if (incomingSecret !== storedSecret) {
    console.error("Webhook secret mismatch");
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const body = await req.json();
  console.log("whatsapp-config body action:", body.action || "config-push", "tenant_id:", body.tenant_id);

  // Disconnect actie — scoped op tenant_id
  if (body.action === "disconnect") {
    if (!body.tenant_id) {
      return jsonRes({ error: "tenant_id is verplicht voor disconnect" }, 400);
    }
    await supabase.from("whatsapp_config").delete().eq("tenant_id", body.tenant_id);
    return jsonRes({ ok: true, disconnected: true });
  }

  // Upsert credentials (config push from SiteJob Connect)
  // Use phone_number_id as natural key instead of hardcoded UUID
  if (!body.phone_number_id) {
    return jsonRes({ error: "phone_number_id is verplicht" }, 400);
  }

  const { error } = await supabase
    .from("whatsapp_config")
    .upsert(
      {
        phone_number_id: body.phone_number_id,
        access_token: body.access_token,
        display_phone: body.display_phone || null,
        waba_id: body.waba_id || null,
        tenant_id: body.tenant_id || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "phone_number_id" }
    );

  if (error) {
    console.error("Config upsert failed:", error.message);
    return jsonRes({ error: error.message }, 500);
  }

  console.log("Config push succesvol opgeslagen voor tenant:", body.tenant_id);
  return jsonRes({ ok: true });
});
