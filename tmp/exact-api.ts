import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify webhook secret from header
    const receivedSecret = req.headers.get("X-Webhook-Secret");
    if (!receivedSecret) {
      return new Response("Missing X-Webhook-Secret header", { status: 401 });
    }

    const body = await req.json();
    const { tenant_id, division, company_name, region, action } = body;

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find connection by tenant_id and verify secret
    const { data: connection } = await supabase
      .from("exact_online_connections")
      .select("id, webhook_secret")
      .eq("tenant_id", tenant_id)
      .single();

    // For disconnect action or config push, verify the secret matches
    if (connection) {
      // Import crypto to decrypt stored secret for comparison
      const { decryptToken, isEncrypted } = await import("../_shared/crypto.ts");
      let storedSecret = connection.webhook_secret;
      if (storedSecret && isEncrypted(storedSecret)) {
        storedSecret = await decryptToken(storedSecret);
      }
      if (storedSecret !== receivedSecret) {
        return new Response("Invalid webhook secret", { status: 401 });
      }
    }

    // Handle disconnect
    if (action === "disconnect") {
      if (connection) {
        await supabase
          .from("exact_online_connections")
          .update({ is_active: false })
          .eq("id", connection.id);
      }

      return new Response(JSON.stringify({ success: true, action: "disconnected" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle config push (after successful OAuth)
    if (connection) {
      // Update existing connection
      await supabase
        .from("exact_online_connections")
        .update({
          exact_division: division,
          company_name: company_name || null,
          region: region || "nl",
          is_active: true,
          connected_at: new Date().toISOString(),
        })
        .eq("id", connection.id);
    } else {
      // This shouldn't normally happen (tenant should be registered first)
      // but handle gracefully
      console.warn("Config received for unknown tenant_id:", tenant_id);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Config endpoint error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
