import { corsHeaders } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token || token.length < 10) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createServiceClient();

    const { data: wo, error } = await supabase
      .from("work_orders")
      .select("work_order_number, status, created_at, completed_at, company_id, customers(name), services(name)")
      .eq("share_token", token)
      .single();

    if (error || !wo) {
      return new Response(JSON.stringify({ error: "Werkbon niet gevonden" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch company branding
    const { data: company } = await supabase
      .from("companies")
      .select("name, logo_url, brand_color")
      .eq("id", wo.company_id)
      .single();

    return new Response(
      JSON.stringify({
        work_order_number: wo.work_order_number,
        status: wo.status,
        created_at: wo.created_at,
        completed_at: wo.completed_at,
        customer_name: (wo.customers as any)?.name ?? null,
        service_name: (wo.services as any)?.name ?? null,
        company_name: company?.name ?? null,
        company_logo: company?.logo_url ?? null,
        company_color: company?.brand_color ?? null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("work-order-public error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
