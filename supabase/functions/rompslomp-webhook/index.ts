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

  // Verify webhook secret
  const { data: company, error: findError } = await supabaseAdmin
    .from("companies")
    .select("id")
    .eq("rompslomp_webhook_secret", webhookSecret)
    .single();

  if (findError || !company) {
    console.error("Company not found for webhook_secret");
    return jsonRes({ error: "Invalid webhook secret" }, 401);
  }

  const body = await req.json();
  const { event_type, resource_type, resource_id } = body;

  console.log("Rompslomp webhook received:", { event_type, resource_type, resource_id, company_id: company.id });

  // Handle invoice payment status updates
  if (event_type === "invoice.paid" && resource_id) {
    const { data: invoice } = await supabaseAdmin
      .from("invoices")
      .select("id")
      .eq("rompslomp_id", String(resource_id))
      .eq("company_id", company.id)
      .maybeSingle();

    if (invoice) {
      await supabaseAdmin
        .from("invoices")
        .update({ status: "betaald", paid_at: new Date().toISOString().split("T")[0] })
        .eq("id", invoice.id);
      console.log("Invoice marked as paid:", invoice.id);
    }
  }

  return jsonRes({ success: true });
});
