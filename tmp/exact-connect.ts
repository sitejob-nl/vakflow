import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getExactTokenFromConnection } from "../_shared/exact-connect.ts";
import { requireAuth } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await requireAuth(req);
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { divisionId, endpoint, method = "GET", body } = await req.json();

    if (!divisionId || !endpoint) {
      throw new Error("divisionId and endpoint are required");
    }

    // Get connection for this division
    const { data: connection, error: connError } = await supabase
      .from("exact_online_connections")
      .select("*")
      .eq("division_id", divisionId)
      .eq("is_active", true)
      .single();

    if (connError || !connection) {
      throw new Error("No active Exact Online connection found for this division");
    }

    // Get fresh token from SiteJob Connect
    const tokenData = await getExactTokenFromConnection(connection);

    // Make the actual API request to Exact Online
    const exactEndpoint = endpoint.replace("{division}", tokenData.division.toString());
    const exactUrl = `${tokenData.base_url}${exactEndpoint}`;

    const exactResponse = await fetch(exactUrl, {
      method,
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!exactResponse.ok) {
      const errorText = await exactResponse.text();
      console.error("Exact API error:", errorText);
      throw new Error(`Exact API error: ${exactResponse.status} - ${errorText}`);
    }

    const data = await exactResponse.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("API proxy error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
