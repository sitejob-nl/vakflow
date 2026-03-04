import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");
    const domain = url.searchParams.get("domain");

    if (!slug && !domain) {
      return new Response(
        JSON.stringify({ error: "Missing slug or domain parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate inputs
    if (slug && !/^[a-z0-9-]+$/.test(slug)) {
      return new Response(
        JSON.stringify({ error: "Invalid slug" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (domain && !/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(domain)) {
      return new Response(
        JSON.stringify({ error: "Invalid domain" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let query = supabase
      .from("companies")
      .select("id, name, logo_url, brand_color, industry, subcategory");

    if (slug) {
      query = query.eq("slug", slug);
    } else if (domain) {
      query = query.eq("custom_domain", domain);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      return new Response(
        JSON.stringify({ error: "Tenant not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        id: data.id,
        name: data.name,
        logo_url: data.logo_url,
        brand_color: data.brand_color,
        industry: data.industry,
        subcategory: data.subcategory,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
