// meta-webhook/index.ts — GEFIXED: signature verificatie + betere error handling

import { corsHeaders, jsonRes, optionsResponse } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { verifyMetaSignature, verifyWebhookChallenge } from "../_shared/webhook-verify.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  const url = new URL(req.url);

  // ─── GET: Webhook verification (Meta hub.challenge) ───
  if (req.method === "GET") {
    const expectedToken = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN");
    if (!expectedToken) {
      console.error("META_WEBHOOK_VERIFY_TOKEN not configured");
      return jsonRes({ error: "Server misconfigured" }, 500);
    }

    const challengeResponse = verifyWebhookChallenge(url, expectedToken);
    if (challengeResponse) return challengeResponse;

    return jsonRes({ error: "Invalid mode" }, 400);
  }

  // ─── POST: Incoming webhook events ───
  if (req.method === "POST") {
    // Stap 1: Lees raw body voor signature verificatie
    const rawBody = await req.text();

    // Stap 2: Verifieer Meta signature (KRITIEK voor security)
    const appSecret = Deno.env.get("META_APP_SECRET");
    if (!appSecret) {
      console.error("META_APP_SECRET not configured — webhook events cannot be verified");
      return jsonRes({ error: "Server misconfigured" }, 500);
    }

    const signatureHeader = req.headers.get("X-Hub-Signature-256");
    const isValid = await verifyMetaSignature(rawBody, signatureHeader, appSecret);

    if (!isValid) {
      console.error("Meta webhook signature verification failed");
      return jsonRes({ error: "Invalid signature" }, 403);
    }

    // Stap 3: Parse body na verificatie
    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return jsonRes({ error: "Invalid JSON" }, 400);
    }

    console.log("Meta webhook received:", JSON.stringify(body).slice(0, 500));

    const supabase = createAdminClient();
    const entries = body?.entry || [];

    for (const entry of entries) {
      const pageId = entry.id;

      // Zoek company op basis van page_id (multi-tenant)
      const { data: config } = await supabase
        .from("meta_config")
        .select("company_id")
        .eq("page_id", pageId)
        .maybeSingle();

      if (!config) {
        console.log(`No config found for page_id: ${pageId}`);
        continue;
      }
      const companyId = config.company_id;

      // ─── Leadgen events ───
      const changes = entry.changes || [];
      for (const change of changes) {
        if (change.field === "leadgen") {
          const leadData = change.value;
          const { error } = await supabase.from("meta_leads").upsert(
            {
              company_id: companyId,
              lead_id: String(leadData.leadgen_id),
              form_id: String(leadData.form_id || ""),
              form_name: leadData.form_name || null,
              customer_data: leadData,
              status: "nieuw",
            },
            { onConflict: "lead_id" }
          );
          if (error) {
            console.error(`Lead save error: ${error.message}`);
          } else {
            console.log(`Lead saved: ${leadData.leadgen_id}`);
          }
        }

        // ─── Feed events (posts/comments) ───
        if (change.field === "feed") {
          const feedData = change.value;
          console.log(`Feed event for company ${companyId}:`, JSON.stringify(feedData).slice(0, 300));
          // Optioneel: sla feed events op als je die wilt tracken
        }
      }

      // ─── Messaging events (Messenger + Instagram) ───
      const messaging = entry.messaging || [];
      for (const msg of messaging) {
        const senderId = msg.sender?.id;
        const messageContent = msg.message?.text || null;
        const messageId = msg.message?.mid || null;
        const platform = entry.id === msg.recipient?.id ? "messenger" : "instagram";

        if (senderId && messageContent) {
          const { error } = await supabase.from("meta_conversations").insert({
            company_id: companyId,
            platform,
            sender_id: String(senderId),
            sender_name: null,
            content: messageContent,
            direction: "incoming",
            message_id: messageId,
            metadata: msg,
          });
          if (error) {
            console.error(`Message save error: ${error.message}`);
          } else {
            console.log(`Message saved from ${senderId} on ${platform}`);
          }
        }

        // ─── Postback events (knoppen in Messenger) ───
        if (msg.postback) {
          const { error } = await supabase.from("meta_conversations").insert({
            company_id: companyId,
            platform: "messenger",
            sender_id: String(senderId),
            sender_name: null,
            content: msg.postback.title || msg.postback.payload || "[Knop]",
            direction: "incoming",
            message_id: null,
            metadata: msg,
          });
          if (error) console.error(`Postback save error: ${error.message}`);
        }
      }
    }

    // Meta verwacht altijd 200 terug, anders retry het
    return jsonRes({ success: true });
  }

  return jsonRes({ error: "Method not allowed" }, 405);
});
