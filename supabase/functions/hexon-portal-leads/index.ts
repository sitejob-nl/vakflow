import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const payload = await req.json();

    // Hexon portal lead payload (varies by portal, normalized by Hexon)
    const {
      stocknumber,
      source_site, // 'marktplaats', 'autoscout24', 'autotrack', etc.
      lead_name,
      lead_email,
      lead_phone,
      lead_message,
      vehicle_info,
    } = payload;

    if (!stocknumber) {
      return new Response(JSON.stringify({ error: "Missing stocknumber" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find trade_vehicle by hexon_stocknumber
    const { data: tradeVehicle } = await supabase
      .from("trade_vehicles")
      .select("id, company_id, brand, model, license_plate, target_sell_price")
      .eq("hexon_stocknumber", stocknumber)
      .maybeSingle();

    if (!tradeVehicle) {
      console.error("No trade_vehicle for stocknumber:", stocknumber);
      return new Response(JSON.stringify({ error: "Unknown vehicle" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const companyId = tradeVehicle.company_id;

    // Deduplicate customer: check email first, then phone
    let customerId: string | null = null;

    if (lead_email) {
      const { data: existing } = await supabase
        .from("customers")
        .select("id")
        .eq("company_id", companyId)
        .ilike("email", lead_email)
        .limit(1)
        .maybeSingle();
      customerId = existing?.id || null;
    }

    if (!customerId && lead_phone) {
      const normalized = lead_phone.replace(/[\s\-\(\)]/g, "").replace(/^\+31/, "0").replace(/^0031/, "0");
      const { data: existing } = await supabase
        .from("customers")
        .select("id")
        .eq("company_id", companyId)
        .or(`phone.ilike.%${normalized.slice(-9)}%`)
        .limit(1)
        .maybeSingle();
      customerId = existing?.id || null;
    }

    // Create customer if new
    if (!customerId) {
      const { data: newCustomer, error: customerError } = await supabase
        .from("customers")
        .insert({
          company_id: companyId,
          name: lead_name || "Onbekend",
          email: lead_email || null,
          phone: lead_phone || null,
          type: "particulier",
          notes: `Lead via ${source_site || "portaal"} - ${tradeVehicle.brand} ${tradeVehicle.model}`,
        })
        .select("id")
        .single();

      if (customerError) {
        console.error("Failed to create customer:", customerError);
      } else {
        customerId = newCustomer.id;
      }
    }

    // Get first lead status for this company (Nieuw)
    const { data: firstStatus } = await supabase
      .from("lead_statuses")
      .select("id")
      .eq("company_id", companyId)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();

    // Create lead
    const vehicleLabel = `${tradeVehicle.brand} ${tradeVehicle.model}`;
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .insert({
        company_id: companyId,
        status_id: firstStatus?.id,
        name: lead_name || "Portaal-lead",
        email: lead_email || null,
        phone: lead_phone || null,
        source: source_site || "hexon",
        value: tradeVehicle.target_sell_price || 0,
        notes: `Interesse in ${vehicleLabel}${lead_message ? `\n\nBericht: ${lead_message}` : ""}`,
        custom_fields: {
          trade_vehicle_id: tradeVehicle.id,
          stocknumber,
          portal: source_site,
          vehicle: vehicleLabel,
          original_message: lead_message,
        },
      })
      .select("id")
      .single();

    if (leadError) {
      console.error("Failed to create lead:", leadError);
    }

    // Log communication
    await supabase.from("communication_logs").insert({
      company_id: companyId,
      customer_id: customerId,
      channel: "portal",
      direction: "inbound",
      subject: `Portaal-lead: ${vehicleLabel} via ${source_site || "Hexon"}`,
      body: lead_message || `Interesse in ${vehicleLabel}`,
      is_automated: true,
      status: "delivered",
      sent_at: new Date().toISOString(),
    });

    // Notify team
    const { data: admins } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("company_id", companyId)
      .in("role", ["admin", "verkoop"])
      .limit(3);

    for (const admin of admins || []) {
      await supabase.from("notifications").insert({
        company_id: companyId,
        user_id: admin.user_id,
        title: `Nieuwe lead: ${vehicleLabel}`,
        body: `${lead_name || "Onbekend"} via ${source_site || "portaal"}${lead_phone ? ` - ${lead_phone}` : ""}`,
        link_page: "leads",
        link_params: { id: lead?.id },
      });
    }

    // Trigger AI intake via WhatsApp if customer has phone and AI agent is enabled
    if (customerId && lead_phone) {
      const { data: aiConfig } = await supabase
        .from("ai_agent_config")
        .select("enabled")
        .eq("company_id", companyId)
        .single();

      if (aiConfig?.enabled) {
        const aiIntakeUrl = `${supabaseUrl}/functions/v1/ai-intake`;
        EdgeRuntime?.waitUntil?.(
          fetch(aiIntakeUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              company_id: companyId,
              customer_id: customerId,
              phone_number: lead_phone,
              trigger: "portal_lead",
              vehicle_info: vehicleLabel,
              lead_id: lead?.id,
            }),
          })
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        lead_id: lead?.id,
        customer_id: customerId,
        is_new_customer: !customerId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("hexon-portal-leads error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
