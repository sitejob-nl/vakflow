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

  const secret = req.headers.get("X-Webhook-Secret");
  if (secret !== Deno.env.get("WHATSAPP_WEBHOOK_SECRET")) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const body = await req.json();

  // Disconnect actie
  if (body.action === "disconnect") {
    await supabase.from("whatsapp_config").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    return new Response(JSON.stringify({ ok: true, disconnected: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Upsert credentials
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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
