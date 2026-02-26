import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonRes({ error: "Method not allowed" }, 405);
  }

  // Authenticate user via JWT
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonRes({ error: "Niet ingelogd" }, 401);
  }

  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return jsonRes({ error: "Niet ingelogd" }, 401);
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const body = await req.json();
  const { name, webhook_url } = body;

  if (!name || !webhook_url) {
    return jsonRes({ error: "name en webhook_url zijn verplicht" }, 400);
  }

  const connectApiKey = Deno.env.get("CONNECT_API_KEY");
  if (!connectApiKey) {
    return jsonRes({ error: "CONNECT_API_KEY is niet geconfigureerd" }, 500);
  }

  // Register tenant at SiteJob Connect
  const registerRes = await fetch(
    "https://xeshjkznwdrxjjhbpisn.supabase.co/functions/v1/whatsapp-register-tenant",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": connectApiKey,
      },
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

  // Store tenant_id + webhook_secret in whatsapp_config
  const { error: upsertError } = await supabaseAdmin
    .from("whatsapp_config")
    .upsert(
      {
        id: "00000000-0000-0000-0000-000000000001",
        phone_number_id: "pending",
        access_token: "pending",
        tenant_id,
        webhook_secret: webhook_secret || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (upsertError) {
    console.error("Upsert whatsapp_config failed:", upsertError);
    return jsonRes({ error: "Kon tenant_id niet opslaan" }, 500);
  }

  console.log("Tenant geregistreerd, webhook_secret opgeslagen:", !!webhook_secret);

  return jsonRes({ tenant_id, webhook_secret: webhook_secret ? "ontvangen" : "bestaand" });
});
