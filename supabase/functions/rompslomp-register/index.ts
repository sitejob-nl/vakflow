import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
  const userId = claimsData.claims.sub;

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Get company_id from profile
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("company_id")
    .eq("id", userId)
    .single();

  if (!profile?.company_id) {
    return jsonRes({ error: "Geen bedrijf gevonden" }, 400);
  }

  const body = await req.json();
  const { client_id, client_secret } = body;

  if (!client_id || !client_secret) {
    return jsonRes({ error: "client_id en client_secret zijn verplicht" }, 400);
  }

  const connectApiKey = Deno.env.get("CONNECT_API_KEY");
  if (!connectApiKey) {
    return jsonRes({ error: "CONNECT_API_KEY is niet geconfigureerd" }, 500);
  }

  // Get company name
  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("name")
    .eq("id", profile.company_id)
    .single();

  const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/rompslomp-webhook`;

  // Register tenant at SiteJob Connect
  const registerRes = await fetch(
    "https://xeshjkznwdrxjjhbpisn.supabase.co/functions/v1/rompslomp-register-tenant",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": connectApiKey,
      },
      body: JSON.stringify({
        name: company?.name || "Mijn Applicatie",
        webhook_url: webhookUrl,
        client_id,
        client_secret,
        scopes: "public",
      }),
    }
  );

  if (!registerRes.ok) {
    const errorText = await registerRes.text();
    console.error("Register tenant failed:", registerRes.status, errorText);
    return jsonRes({ error: "Tenant registratie mislukt: " + errorText }, registerRes.status);
  }

  const registerData = await registerRes.json();
  const { tenant_id, webhook_secret } = registerData;

  if (!tenant_id) {
    return jsonRes({ error: "Geen tenant_id ontvangen van Connect" }, 500);
  }

  // Store tenant_id + webhook_secret in companies table
  const { error: updateError } = await supabaseAdmin
    .from("companies")
    .update({
      rompslomp_tenant_id: tenant_id,
      rompslomp_webhook_secret: webhook_secret || null,
    })
    .eq("id", profile.company_id);

  if (updateError) {
    console.error("Update company failed:", updateError);
    return jsonRes({ error: "Kon tenant_id niet opslaan" }, 500);
  }

  console.log("Rompslomp tenant geregistreerd voor company:", profile.company_id);

  return jsonRes({ tenant_id, webhook_secret: webhook_secret ? "ontvangen" : "bestaand" });
});
