import { corsHeaders, jsonRes, optionsResponse } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const supabase = createAdminClient();

  // Read body first — we need tenant_id for scoped secret lookup
  const body = await req.json();
  const tenantId = body.tenant_id;

  if (!tenantId) {
    return jsonRes({ error: "tenant_id is verplicht" }, 400);
  }

  console.log("whatsapp-config called, action:", body.action || "config-push", "tenant_id:", tenantId);

  // Scoped webhook secret lookup on tenant_id
  const { data: existingConfig } = await supabase
    .from("whatsapp_config")
    .select("webhook_secret")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const storedSecret = existingConfig?.webhook_secret || Deno.env.get("WHATSAPP_WEBHOOK_SECRET");

  if (!storedSecret) {
    console.error("Geen webhook_secret gevonden voor tenant:", tenantId);
    return new Response("Server misconfigured", { status: 500, headers: corsHeaders });
  }

  const incomingSecret = req.headers.get("X-Webhook-Secret");
  if (incomingSecret !== storedSecret) {
    console.error("Webhook secret mismatch voor tenant:", tenantId);
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  // Disconnect actie — scoped op tenant_id
  if (body.action === "disconnect") {
    await supabase.from("whatsapp_config").delete().eq("tenant_id", tenantId);
    return jsonRes({ ok: true, disconnected: true });
  }

  // Config push: UPDATE existing row WHERE tenant_id instead of upsert on phone_number_id
  if (!body.phone_number_id) {
    return jsonRes({ error: "phone_number_id is verplicht" }, 400);
  }

  const { error, count } = await supabase
    .from("whatsapp_config")
    .update({
      phone_number_id: body.phone_number_id,
      access_token: body.access_token,
      display_phone: body.display_phone || null,
      waba_id: body.waba_id || null,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId);

  if (error) {
    console.error("Config update failed:", error.message);
    return jsonRes({ error: error.message }, 500);
  }

  console.log("Config push succesvol opgeslagen voor tenant:", tenantId);
  return jsonRes({ ok: true });
});
