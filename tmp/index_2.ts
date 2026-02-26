import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { trigger_type, lead_id, old_status_id, new_status_id } = await req.json();

    console.log(`Automation trigger: ${trigger_type} for lead ${lead_id}`);

    if (!trigger_type || !lead_id) {
      return new Response(
        JSON.stringify({ error: "Missing trigger_type or lead_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the lead data
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", lead_id)
      .single();

    if (leadError || !lead) {
      console.error("Lead not found:", leadError);
      return new Response(
        JSON.stringify({ error: "Lead not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if lead has a phone number
    if (!lead.phone) {
      console.log("Lead has no phone number, skipping automation");
      return new Response(
        JSON.stringify({ skipped: true, reason: "No phone number" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch active automations matching trigger type
    const { data: automations, error: autoError } = await supabase
      .from("whatsapp_automations")
      .select("*")
      .eq("trigger_type", trigger_type)
      .eq("is_active", true);

    if (autoError || !automations || automations.length === 0) {
      console.log("No active automations found for trigger:", trigger_type);
      return new Response(
        JSON.stringify({ skipped: true, reason: "No matching automations" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: any[] = [];

    for (const automation of automations) {
      try {
        // Check trigger-specific config
        if (trigger_type === "status_changed") {
          const targetStatusId = automation.trigger_config?.status_id;
          if (targetStatusId && targetStatusId !== new_status_id) {
            console.log(`Automation ${automation.name}: status ${new_status_id} doesn't match target ${targetStatusId}`);
            continue;
          }
        }

        // Check conditions
        const conditions = automation.conditions || {};
        if (conditions.pipeline && conditions.pipeline !== lead.type) {
          console.log(`Automation ${automation.name}: pipeline mismatch (${lead.type} vs ${conditions.pipeline})`);
          continue;
        }
        if (conditions.customer_type && conditions.customer_type !== lead.customer_type) {
          console.log(`Automation ${automation.name}: customer_type mismatch`);
          continue;
        }

        // Build template parameters from variable mapping
        const mapping = automation.variable_mapping || {};
        const paramFormat = ((automation as any).parameter_format || '').toLowerCase();
        const isNamed = paramFormat === 'named' || Object.keys(mapping).some(k => isNaN(Number(k)));

        const parameters: any[] = [];
        for (const [paramKey, leadField] of Object.entries(mapping)) {
          const value = String((lead as any)[leadField as string] || "");
          if (isNamed) {
            parameters.push({
              type: "text",
              parameter_name: paramKey,
              text: value,
            });
          } else {
            parameters.push({
              type: "text",
              text: value,
            });
          }
        }

        const components: any[] = [];
        if (parameters.length > 0) {
          components.push({ type: "body", parameters });
        }

        // Build preview text
        let preview = `[Auto: ${automation.name}] Template: ${automation.template_name}`;

        // Send via whatsapp-send
        const sendResponse = await fetch(`${supabaseUrl}/functions/v1/whatsapp-send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
          },
          body: JSON.stringify({
            to: lead.phone,
            lead_id: lead.id,
            type: "template",
            template: {
              name: automation.template_name,
              language: automation.template_language || "nl",
              components,
              preview,
            },
          }),
        });

        const sendResult = await sendResponse.json();
        console.log(`Automation ${automation.name} sent:`, sendResult);
        results.push({ automation: automation.name, success: sendResponse.ok, result: sendResult });
      } catch (err) {
        console.error(`Automation ${automation.name} error:`, err);
        results.push({ automation: automation.name, success: false, error: err.message });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Automation trigger error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
