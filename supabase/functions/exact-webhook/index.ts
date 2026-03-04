import { jsonRes, optionsResponse } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  try {
    const webhookSecret = req.headers.get("x-webhook-secret");
    const url = new URL(req.url);
    const companyId = url.searchParams.get("company_id");

    if (!webhookSecret || !companyId) {
      return jsonRes({ error: "Missing webhook secret or company_id" }, 401);
    }

    const supabaseAdmin = createAdminClient();

    // Verify webhook secret
    const { data: config } = await supabaseAdmin
      .from("exact_config")
      .select("id, webhook_secret")
      .eq("company_id", companyId)
      .maybeSingle();

    if (!config || config.webhook_secret !== webhookSecret) {
      console.error("Invalid webhook for company:", companyId);
      return jsonRes({ error: "Invalid secret" }, 403);
    }

    const body = await req.json();
    const { Topic, Division, Key, ExactOnlineEndpoint, EventAction } = body;

    console.log(`Exact webhook: ${EventAction} ${Topic} key=${Key} division=${Division} company=${companyId}`);

    // Phase 1: just log. Phase 2: process events (sync invoices, contacts, etc.)
    // For now we acknowledge the webhook
    return jsonRes({ ok: true });
  } catch (err: any) {
    console.error("exact-webhook error:", err);
    return jsonRes({ error: err.message || "Internal error" }, 500);
  }
});
