import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_ROUTES_API_KEY");
    if (!GOOGLE_API_KEY) {
      throw new Error("GOOGLE_ROUTES_API_KEY not configured");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch customers with address but no coordinates (max 50 per call)
    const { data: customers, error } = await supabase
      .from("customers")
      .select("id, address, postal_code, city")
      .not("address", "is", null)
      .is("lat", null)
      .limit(50);

    if (error) throw error;

    let geocodedCount = 0;
    const errors: string[] = [];

    for (const customer of customers ?? []) {
      const parts = [customer.address, customer.postal_code, customer.city].filter(Boolean);
      if (parts.length === 0) continue;

      const query = parts.join(", ");

      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&region=nl&language=nl&key=${GOOGLE_API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();

        const result = data.results?.[0];
        if (result?.geometry?.location) {
          const lat = result.geometry.location.lat;
          const lng = result.geometry.location.lng;

          const { error: updateError } = await supabase
            .from("customers")
            .update({ lat, lng })
            .eq("id", customer.id);

          if (updateError) {
            errors.push(`Update ${customer.id}: ${updateError.message}`);
          } else {
            geocodedCount++;
          }
        }
      } catch (err) {
        errors.push(`Geocode ${customer.id}: ${err.message}`);
      }

      // Small delay to respect rate limits
      await new Promise((r) => setTimeout(r, 100));
    }

    return new Response(
      JSON.stringify({
        geocoded: geocodedCount,
        total: customers?.length ?? 0,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Geocode error:", err);
    return new Response(
      JSON.stringify({ error: "Interne fout bij geocodering", code: "GEOCODE_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
