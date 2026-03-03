import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);

  // GET = webhook verification (Meta sends hub.challenge)
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe") {
      // Look up verify token from meta_config
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const { data: configs } = await supabase
        .from("meta_config")
        .select("webhook_verify_token")
        .not("webhook_verify_token", "is", null);

      const match = configs?.find((c: any) => c.webhook_verify_token === token);
      if (match) {
        return new Response(challenge, { status: 200, headers: corsHeaders });
      }
      return jsonRes({ error: "Verification failed" }, 403);
    }
    return jsonRes({ error: "Invalid mode" }, 400);
  }

  // POST = incoming webhook event
  if (req.method === "POST") {
    const body = await req.json();
    console.log("Meta webhook received:", JSON.stringify(body).slice(0, 500));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const entries = body?.entry || [];
    for (const entry of entries) {
      const pageId = entry.id;

      // Find company by page_id
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

      // Handle leadgen events
      const changes = entry.changes || [];
      for (const change of changes) {
        if (change.field === "leadgen") {
          const leadData = change.value;
          await supabase.from("meta_leads").upsert(
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
          console.log(`Lead saved: ${leadData.leadgen_id}`);
        }
      }

      // Handle messaging events (Messenger + Instagram)
      const messaging = entry.messaging || [];
      for (const msg of messaging) {
        const senderId = msg.sender?.id;
        const messageContent = msg.message?.text || null;
        const messageId = msg.message?.mid || null;
        const platform = entry.id === msg.recipient?.id ? "messenger" : "instagram";

        if (senderId && messageContent) {
          await supabase.from("meta_conversations").insert({
            company_id: companyId,
            platform,
            sender_id: String(senderId),
            sender_name: null,
            content: messageContent,
            direction: "incoming",
            message_id: messageId,
            metadata: msg,
          });
          console.log(`Message saved from ${senderId} on ${platform}`);
        }
      }
    }

    return jsonRes({ success: true });
  }

  return jsonRes({ error: "Method not allowed" }, 405);
});
