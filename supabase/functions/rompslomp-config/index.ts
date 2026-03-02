import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
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

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const webhookSecret = req.headers.get("X-Webhook-Secret");
  if (!webhookSecret) {
    return jsonRes({ error: "Missing X-Webhook-Secret header" }, 401);
  }

  const body = await req.json();
  const { tenant_id, company_id, company_name, action } = body;

  // Find company by webhook_secret
  const { data: company, error: findError } = await supabaseAdmin
    .from("companies")
    .select("id, rompslomp_tenant_id")
    .eq("rompslomp_webhook_secret", webhookSecret)
    .single();

  if (findError || !company) {
    console.error("Company not found for webhook_secret");
    return jsonRes({ error: "Invalid webhook secret" }, 401);
  }

  // Handle disconnect
  if (action === "disconnect") {
    const { error: updateError } = await supabaseAdmin
      .from("companies")
      .update({
        rompslomp_company_id: null,
        rompslomp_company_name: null,
      })
      .eq("id", company.id);

    if (updateError) {
      console.error("Disconnect update failed:", updateError);
      return jsonRes({ error: "Update failed" }, 500);
    }

    console.log("Rompslomp disconnected for company:", company.id);
    return jsonRes({ success: true, action: "disconnected" });
  }

  // Handle config push (company_id + company_name from Rompslomp)
  if (company_id || company_name) {
    const { error: updateError } = await supabaseAdmin
      .from("companies")
      .update({
        rompslomp_company_id: company_id || null,
        rompslomp_company_name: company_name || null,
      })
      .eq("id", company.id);

    if (updateError) {
      console.error("Config update failed:", updateError);
      return jsonRes({ error: "Update failed" }, 500);
    }

    console.log("Rompslomp config pushed for company:", company.id, { company_id, company_name });
    return jsonRes({ success: true, action: "configured" });
  }

  return jsonRes({ success: true, action: "no-op" });
});
