import { jsonRes, optionsResponse } from "../_shared/cors.ts";
import { createAdminClient, createUserClient } from "../_shared/supabase.ts";
import { normalizePhone } from "../_shared/phone.ts";

/** Resolve a dotted path like "customer.name" against the context */
function resolveField(path: string, context: Record<string, any>): string {
  const parts = path.split(".");
  let value: any = context;
  for (const p of parts) {
    if (value == null) return "";
    value = value[p];
  }
  return String(value ?? "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonRes({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createAdminClient();

    // Accept either authenticated user call or internal service call
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;

    if (authHeader?.startsWith("Bearer ")) {
      const supabaseUser = createUserClient(authHeader);
      const { data: { user }, error } = await supabaseUser.auth.getUser();
      if (!error && user) {
        userId = user.id;
      }
    }

    const { trigger_type, customer_id, context: ctx } = await req.json();
    console.log(`Automation trigger: ${trigger_type} for customer ${customer_id}`);

    if (!trigger_type || !customer_id) {
      return jsonRes({ error: "Missing trigger_type or customer_id" }, 400);
    }

    // Fetch customer
    const { data: customer, error: custErr } = await supabase
      .from("customers")
      .select("*")
      .eq("id", customer_id)
      .single();

    if (custErr || !customer) {
      console.error("Customer not found:", custErr);
      return jsonRes({ error: "Customer not found" }, 404);
    }

    if (!customer.phone) {
      console.log("Customer has no phone number, skipping");
      return jsonRes({ skipped: true, reason: "No phone number" });
    }

    if (!customer.whatsapp_optin) {
      console.log("Customer has no WhatsApp opt-in, skipping");
      return jsonRes({ skipped: true, reason: "No WhatsApp opt-in" });
    }

    // Fetch active automations for this trigger type
    const automationQuery = supabase
      .from("whatsapp_automations")
      .select("*")
      .eq("trigger_type", trigger_type)
      .eq("is_active", true);
    if (!customer.company_id) {
      console.error("Customer has no company_id, cannot determine automations");
      return jsonRes({ error: "Customer has no company_id" }, 400);
    }
    automationQuery.eq("company_id", customer.company_id);
    const { data: automations } = await automationQuery;

    if (!automations || automations.length === 0) {
      console.log("No active automations for trigger:", trigger_type);
      return jsonRes({ skipped: true, reason: "No matching automations" });
    }

    const fullContext: Record<string, any> = { customer, ...(ctx || {}) };
    const results: any[] = [];

    // Fetch whatsapp_config for this company to resolve template previews
    const { data: waConfig } = await supabase
      .from("whatsapp_config")
      .select("access_token, waba_id")
      .eq("company_id", customer.company_id)
      .single();

    // Cache fetched template bodies to avoid duplicate API calls
    const templateBodyCache: Record<string, string> = {};

    for (const automation of automations) {
      try {
        const conditions = automation.conditions || {};
        if (conditions.customer_type && conditions.customer_type !== customer.type) {
          results.push({ automation: automation.name, skipped: true, reason: "condition_mismatch" });
          continue;
        }

        const mapping = automation.variable_mapping || {};
        const isNamed = Object.keys(mapping).some((k) => isNaN(Number(k)));

        const parameters: any[] = [];
        for (const [paramKey, fieldPath] of Object.entries(mapping)) {
          const value = resolveField(fieldPath as string, fullContext);
          if (isNamed) {
            parameters.push({ type: "text", parameter_name: paramKey, text: value });
          } else {
            parameters.push({ type: "text", text: value });
          }
        }

        const components: any[] = [];
        if (parameters.length > 0) components.push({ type: "body", parameters });

        // Build preview text from template body
        let preview = "";
        try {
          const cacheKey = `${automation.template_name}_${automation.template_language || "nl"}`;
          if (!(cacheKey in templateBodyCache) && waConfig?.access_token && waConfig?.waba_id) {
            const tplRes = await fetch(
              `https://graph.facebook.com/v25.0/${waConfig.waba_id}/message_templates?name=${automation.template_name}&fields=components,language`,
              { headers: { Authorization: `Bearer ${waConfig.access_token}` } }
            );
            const tplData = await tplRes.json();
            const lang = automation.template_language || "nl";
            const match = tplData.data?.find((t: any) => t.language === lang) || tplData.data?.[0];
            const bodyComp = match?.components?.find((c: any) => c.type === "BODY");
            templateBodyCache[cacheKey] = bodyComp?.text || "";
          }
          let bodyText = templateBodyCache[cacheKey] || "";
          if (bodyText) {
            // Replace positional {{1}}, {{2}} etc. or named {{name}}
            for (const param of parameters) {
              if (param.parameter_name) {
                bodyText = bodyText.replace(`{{${param.parameter_name}}}`, param.text);
              }
            }
            // Replace positional params by index
            parameters.forEach((param: any, idx: number) => {
              bodyText = bodyText.replace(`{{${idx + 1}}}`, param.text);
            });
            preview = bodyText;
          }
        } catch (previewErr) {
          console.error("Preview build failed (non-fatal):", previewErr);
        }

        const sendResponse = await fetch(`${supabaseUrl}/functions/v1/whatsapp-send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            to: customer.phone,
            customer_id: customer.id,
            company_id: customer.company_id,
            type: "template",
            template: {
              name: automation.template_name,
              language: { code: automation.template_language || "nl" },
              components,
            },
            ...(preview ? { preview } : {}),
          }),
        });

        const sendResult = await sendResponse.json();
        console.log(`Automation ${automation.name} result:`, JSON.stringify(sendResult));

        await supabase.from("automation_send_log").insert({
          automation_id: automation.id,
          customer_id: customer_id,
          trigger_type,
          company_id: customer.company_id || automation.company_id || null,
          result: { success: sendResponse.ok, ...sendResult },
        });

        results.push({ automation: automation.name, success: sendResponse.ok, result: sendResult });
      } catch (err) {
        console.error(`Automation ${automation.name} error:`, err);
        results.push({ automation: automation.name, success: false, error: (err as Error).message });
      }
    }

    return jsonRes({ success: true, results });
  } catch (error) {
    console.error("Automation trigger error:", error);
    return jsonRes({ error: (error as Error).message }, 500);
  }
});