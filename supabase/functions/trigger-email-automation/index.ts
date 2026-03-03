import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Replace {{variable}} placeholders in a string */
function replaceVariables(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") return jsonRes({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Authenticate caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonRes({ error: "Unauthorized" }, 401);
    }

    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsErr } = await supabaseUser.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsErr || !claimsData?.claims) {
      return jsonRes({ error: "Invalid session" }, 401);
    }
    const userId = claimsData.claims.sub as string;

    const { trigger_type, customer_id, context: ctx } = await req.json();
    console.log(`Email automation trigger: ${trigger_type} for customer ${customer_id}`);

    if (!trigger_type || !customer_id) {
      return jsonRes({ error: "Missing trigger_type or customer_id" }, 400);
    }

    // Get user's company_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .single();
    const companyId = profile?.company_id;
    if (!companyId) {
      return jsonRes({ error: "No company found" }, 400);
    }

    // Fetch customer
    const { data: customer } = await supabase
      .from("customers")
      .select("*")
      .eq("id", customer_id)
      .single();
    if (!customer) {
      return jsonRes({ error: "Customer not found" }, 404);
    }
    if (!customer.email) {
      console.log("Customer has no email, skipping");
      return jsonRes({ skipped: true, reason: "No email address" });
    }

    // Map trigger_type to message_type in auto_message_settings
    const messageTypeMap: Record<string, string> = {
      work_order_completed: "work_order_summary",
      invoice_sent: "appointment_confirmation", // reuse or create new
    };
    const messageType = messageTypeMap[trigger_type] || trigger_type;

    // Fetch auto_message_settings for this company/user where channel includes email
    const { data: settings } = await supabase
      .from("auto_message_settings")
      .select("*, email_templates(*)")
      .eq("company_id", companyId)
      .eq("message_type", messageType)
      .eq("enabled", true);

    // Filter settings where channel is 'email' or 'both'
    const emailSettings = (settings || []).filter(
      (s: any) => s.channel === "email" || s.channel === "both"
    );

    if (emailSettings.length === 0) {
      console.log("No active email automations for trigger:", trigger_type);
      return jsonRes({ skipped: true, reason: "No matching email automations" });
    }

    // Fetch company info for variables
    const { data: company } = await supabase
      .from("companies")
      .select("name, address, city, phone, logo_url, smtp_email")
      .eq("id", companyId)
      .single();

    // Build variable map
    const variables: Record<string, string> = {
      klantnaam: customer.name || "",
      bedrijfsnaam: company?.name || "",
      adres: customer.address || "",
      datum: new Date().toLocaleDateString("nl-NL"),
      ...(ctx || {}),
    };

    const results: any[] = [];

    for (const setting of emailSettings) {
      try {
        const template = (setting as any).email_templates;
        if (!template) {
          console.log(`Setting ${setting.message_type}: no email template linked, skipping`);
          results.push({ message_type: setting.message_type, skipped: true, reason: "no_template" });
          continue;
        }

        // Replace variables in subject and body
        const subject = replaceVariables(template.subject || "", variables);
        const htmlBody = replaceVariables(template.html_body || "", variables);
        const plainBody = htmlBody.replace(/<[^>]*>/g, "").substring(0, 5000);

        // Send via send-email edge function
        const sendResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
          },
          body: JSON.stringify({
            to: customer.email,
            subject,
            body: plainBody,
            html: htmlBody,
          }),
        });

        const sendResult = await sendResponse.json();
        console.log(`Email automation ${setting.message_type} result:`, JSON.stringify(sendResult));

        // Log to communication_logs
        await supabase.from("communication_logs").insert({
          company_id: companyId,
          customer_id: customer.id,
          channel: "email",
          direction: "outbound",
          subject,
          body: plainBody,
          html_body: htmlBody,
          status: sendResponse.ok ? "sent" : "failed",
          is_automated: true,
          template_name: template.name,
          work_order_id: ctx?.work_order_id || null,
        });

        results.push({
          message_type: setting.message_type,
          success: sendResponse.ok,
          template: template.name,
        });
      } catch (err) {
        console.error(`Email automation error:`, err);
        results.push({
          message_type: setting.message_type,
          success: false,
          error: (err as Error).message,
        });
      }
    }

    return jsonRes({ success: true, results });
  } catch (error) {
    console.error("Email automation trigger error:", error);
    return jsonRes({ error: (error as Error).message }, 500);
  }
});
