import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

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

  // Disconnect actie
  if (body.action === "disconnect") {
    await supabase.from("whatsapp_config").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    return new Response(JSON.stringify({ ok: true, disconnected: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Upsert credentials (config push from SiteJob Connect)
  const { error } = await supabase
    .from("whatsapp_config")
    .upsert(
      {
        id: "00000000-0000-0000-0000-000000000001",
        phone_number_id: body.phone_number_id,
        access_token: body.access_token,
        display_phone: body.display_phone || null,
        waba_id: body.waba_id || null,
        tenant_id: body.tenant_id || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (error) {
    console.error("Config upsert failed:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("Config push succesvol opgeslagen voor tenant:", body.tenant_id);
  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
