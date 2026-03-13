// connect-meta-webhook — Gecombineerd endpoint voor:
// 1. Credential pushes van SiteJob Connect (na OAuth + token refresh)
// 2. Disconnect notificaties
// 3. Doorgestuurde Meta webhooks (leadgen, feed, messages)
// Verificatie via X-SiteJob-Signature HMAC-SHA256

import { jsonRes, optionsResponse } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { logEdgeFunctionError } from "../_shared/error-logger.ts";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

/** HMAC-SHA256 verify */
async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  if (!signature || !secret) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  // Accept GET for Meta webhook verification challenge
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && challenge) {
      console.log("connect-meta-webhook: verification challenge accepted");
      return new Response(challenge, { status: 200 });
    }
    return jsonRes({ error: "Invalid verification" }, 403);
  }

  try {
    const bodyText = await req.text();
    const body = JSON.parse(bodyText);
    const signature = req.headers.get("x-sitejob-signature") || "";
    const tenantId = req.headers.get("x-sitejob-tenant") || body.tenant_id;

    const admin = createAdminClient();

    // Look up config by tenant_id
    const { data: config } = await admin
      .from("meta_marketing_config")
      .select("id, company_id, webhook_secret, tenant_id")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!config) {
      console.error("connect-meta-webhook: no config for tenant_id:", tenantId);
      return jsonRes({ error: "Unknown tenant" }, 404);
    }

    // Verify HMAC signature
    if (signature && config.webhook_secret) {
      const isValid = await verifySignature(bodyText, signature, config.webhook_secret);
      if (!isValid) {
        console.error("connect-meta-webhook: invalid signature for tenant:", tenantId);
        return jsonRes({ error: "Invalid signature" }, 403);
      }
    }

    // --- Credential push (after OAuth or token refresh) ---
    if (body.event === "meta_marketing_credentials") {
      const { error: updateError } = await admin
        .from("meta_marketing_config")
        .update({
          is_connected: true,
          user_access_token: body.user_access_token || null,
          page_access_token: body.page_access_token || null,
          token_expires_at: body.token_expires_at || null,
          ad_account_id: body.ad_account_id || null,
          ad_account_name: body.ad_account_name || null,
          page_id: body.page_id || null,
          page_name: body.page_name || null,
          instagram_id: body.instagram_id || null,
          instagram_username: body.instagram_username || null,
          business_id: body.business_id || null,
          granted_scopes: body.granted_scopes || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", config.id);

      if (updateError) {
        console.error("connect-meta-webhook: credential save failed:", updateError);
        return jsonRes({ error: "Failed to save credentials" }, 500);
      }

      console.log("connect-meta-webhook: credentials saved for company:", config.company_id);
      return new Response("OK", { status: 200 });
    }

    // --- Disconnect ---
    if (body.event === "meta_marketing_disconnected") {
      await admin
        .from("meta_marketing_config")
        .update({
          is_connected: false,
          user_access_token: null,
          page_access_token: null,
          token_expires_at: null,
          ad_account_id: null,
          ad_account_name: null,
          page_id: null,
          page_name: null,
          instagram_id: null,
          instagram_username: null,
          business_id: null,
          granted_scopes: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", config.id);

      console.log("connect-meta-webhook: disconnected for company:", config.company_id);
      return new Response("OK", { status: 200 });
    }

    // --- Meta webhook forwards (leadgen, feed, messages) ---
    if (body.object === "page" && body.entry) {
      const entries = body.entry || [];

      for (const entry of entries) {
        const changes = entry.changes || [];

        for (const change of changes) {
          const field = change.field;
          const value = change.value || {};

          if (field === "leadgen") {
            try {
              // Fetch lead data using stored token
              const { data: fullConfig } = await admin
                .from("meta_marketing_config")
                .select("user_access_token")
                .eq("id", config.id)
                .single();

              if (fullConfig?.user_access_token) {
                const leadRes = await fetch(
                  `${GRAPH_BASE}/${value.leadgen_id}?access_token=${fullConfig.user_access_token}`
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
                  console.log("connect-meta-webhook: lead stored:", value.leadgen_id);
                } else {
                  console.error("connect-meta-webhook: failed to fetch lead:", leadRes.status);
                }
              }
            } catch (err: any) {
              console.error("connect-meta-webhook: lead processing error:", err.message);
              await logEdgeFunctionError(admin, "connect-meta-webhook", err.message, {
                company_id: config.company_id,
                leadgen_id: value.leadgen_id,
              });
            }
          } else if (field === "feed") {
            console.log("connect-meta-webhook: feed event for company:", config.company_id);
          } else if (field === "messages") {
            console.log("connect-meta-webhook: message event for company:", config.company_id);
          }
        }
      }

      return new Response("OK", { status: 200 });
    }

    // Unknown event — accept gracefully
    console.log("connect-meta-webhook: unknown event type:", body.event || "no event field");
    return new Response("OK", { status: 200 });
  } catch (err: any) {
    console.error("connect-meta-webhook error:", err);
    return jsonRes({ error: err.message || "Internal error" }, 500);
  }
});
