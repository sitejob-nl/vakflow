// meta-marketing-webhook — Legacy endpoint, kept for backward compatibility
// New webhook traffic should go to connect-meta-webhook instead.
// Uses locally stored tokens (push-model) instead of fetching from Connect.

import { jsonRes, optionsResponse } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { logEdgeFunctionError } from "../_shared/error-logger.ts";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  // Accept GET for Meta webhook verification
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && challenge) {
      console.log("meta-marketing-webhook: verification challenge accepted");
      return new Response(challenge, { status: 200 });
    }
    return jsonRes({ error: "Invalid verification" }, 403);
  }

  try {
    const webhookSecret = req.headers.get("x-webhook-secret") || req.headers.get("x-sitejob-signature") || "";
    if (!webhookSecret) {
      return jsonRes({ error: "Missing webhook secret" }, 401);
    }

    const body = await req.json();
    const admin = createAdminClient();

    const entries = body.entry || [];
    if (!entries.length) {
      return jsonRes({ ok: true, skipped: "no_entries" });
    }

    // Find the tenant config via webhook_secret
    const { data: config } = await admin
      .from("meta_marketing_config")
      .select("id, company_id, tenant_id, webhook_secret, user_access_token")
      .eq("webhook_secret", webhookSecret)
      .maybeSingle();

    if (!config) {
      console.error("meta-marketing-webhook: no config found for secret");
      return jsonRes({ error: "Unknown webhook secret" }, 403);
    }

    // Process entries
    for (const entry of entries) {
      const changes = entry.changes || [];

      for (const change of changes) {
        const field = change.field;
        const value = change.value || {};

        if (field === "leadgen") {
          try {
            if (!config.user_access_token) {
              console.error("meta-marketing-webhook: no stored token for lead fetch");
              continue;
            }

            const leadRes = await fetch(
              `${GRAPH_BASE}/${value.leadgen_id}?access_token=${config.user_access_token}`
            );

            if (leadRes.ok) {
              const leadData = await leadRes.json();

              await admin.from("meta_leads").insert({
                company_id: config.company_id,
                lead_id: value.leadgen_id,
                form_id: value.form_id || null,
                page_id: value.page_id || entry.id || null,
                customer_data: leadData,
                status: "nieuw",
              });

              console.log("meta-marketing-webhook: lead stored:", value.leadgen_id);
            } else {
              console.error("meta-marketing-webhook: failed to fetch lead:", leadRes.status);
            }
          } catch (err: any) {
            console.error("meta-marketing-webhook: lead processing error:", err.message);
            await logEdgeFunctionError(admin, "meta-marketing-webhook", err.message, {
              company_id: config.company_id,
              leadgen_id: value.leadgen_id,
            });
          }
        } else if (field === "feed") {
          console.log("meta-marketing-webhook: feed event for company:", config.company_id);
        } else if (field === "messages") {
          console.log("meta-marketing-webhook: message event for company:", config.company_id);
        }
      }
    }

    return jsonRes({ ok: true });
  } catch (err: any) {
    console.error("meta-marketing-webhook error:", err);
    return jsonRes({ error: err.message || "Internal error" }, 500);
  }
});
