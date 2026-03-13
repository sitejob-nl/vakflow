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

    // Voys/VoIPGRID webhook payload
    const {
      call_id,
      direction,
      caller_id, // from number
      called_number, // to number
      status, // answered, missed, etc.
      duration,
      timestamp,
      client_uuid,
    } = payload;

    if (!call_id || !client_uuid) {
      return new Response(JSON.stringify({ error: "Missing call_id or client_uuid" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find company by client_uuid via voys_config
    const { data: voysConfig, error: configError } = await supabase
      .from("voys_config")
      .select("*")
      .eq("client_uuid", client_uuid)
      .eq("status", "active")
      .single();

    if (configError || !voysConfig) {
      console.error("No active voys_config for client_uuid:", client_uuid);
      return new Response(JSON.stringify({ error: "Unknown client" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const companyId = voysConfig.company_id;

    // Match caller to customer via phone number
    const lookupNumber = direction === "inbound" ? caller_id : called_number;
    let customerId: string | null = null;

    if (lookupNumber) {
      // Normalize: strip +31, leading 0, spaces, dashes
      const normalized = lookupNumber.replace(/[\s\-\(\)]/g, "").replace(/^\+31/, "0").replace(/^0031/, "0");

      const { data: customers } = await supabase
        .from("customers")
        .select("id, phone")
        .eq("company_id", companyId)
        .or(`phone.ilike.%${normalized.slice(-9)}%`);

      if (customers && customers.length > 0) {
        customerId = customers[0].id;
      }
    }

    // Map Voys status to our status
    const statusMap: Record<string, string> = {
      answered: "answered",
      no_answer: "missed",
      busy: "missed",
      cancelled: "missed",
      voicemail: "voicemail",
    };

    const callStatus = statusMap[status] || status;

    // Create call record
    const { data: callRecord, error: insertError } = await supabase
      .from("call_records")
      .upsert(
        {
          company_id: companyId,
          customer_id: customerId,
          direction: direction || "inbound",
          from_number: caller_id,
          to_number: called_number,
          status: callStatus,
          started_at: timestamp || new Date().toISOString(),
          answered_at: callStatus === "answered" ? timestamp : null,
          ended_at: duration ? new Date(Date.now()).toISOString() : null,
          duration_seconds: duration || null,
          voys_call_id: call_id,
        },
        { onConflict: "voys_call_id" }
      )
      .select()
      .single();

    if (insertError) {
      console.error("Failed to insert call_record:", insertError);
      return new Response(JSON.stringify({ error: "Database error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If call ended and transcription is enabled, fetch from Voys Holodeck API
    if (callRecord && callStatus !== "ringing" && voysConfig.transcribe) {
      // Delay slightly - Voys needs time to process transcription
      // In production, use a pg_cron job or queue instead of inline fetch
      EdgeRuntime?.waitUntil?.(
        fetchTranscriptionAndSummary(supabase, voysConfig, callRecord)
      );
    }

    // If missed call and AI fallback enabled, trigger WhatsApp
    if (callStatus === "missed" && voysConfig.ai_fallback && customerId) {
      EdgeRuntime?.waitUntil?.(
        triggerMissedCallFollowup(supabase, companyId, customerId, caller_id, callRecord.id)
      );
    }

    // Create notification for team
    if (callStatus === "missed" || callStatus === "voicemail") {
      const customerLabel = customerId ? "" : ` (onbekend nummer: ${caller_id})`;
      await supabase.from("notifications").insert({
        company_id: companyId,
        user_id: voysConfig.escalation_users?.[0] || null, // First admin
        title: `Gemiste oproep${customerLabel}`,
        body: `Inkomende oproep van ${caller_id} is niet beantwoord.`,
        link_page: "calltracking",
        link_params: { call_record_id: callRecord.id },
      });
    }

    // Log in communication_logs
    await supabase.from("communication_logs").insert({
      company_id: companyId,
      customer_id: customerId,
      channel: "phone",
      direction: direction || "inbound",
      subject: `${callStatus === "answered" ? "Gesprek" : "Gemiste oproep"} - ${caller_id}`,
      body: `Duur: ${duration || 0}s | Status: ${callStatus}`,
      is_automated: false,
      status: "delivered",
      sent_at: new Date().toISOString(),
      call_record_id: callRecord.id,
    });

    return new Response(JSON.stringify({ success: true, call_record_id: callRecord.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("voys-webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Fetch transcription + summary from Voys Holodeck API
async function fetchTranscriptionAndSummary(
  supabase: any,
  voysConfig: any,
  callRecord: any
) {
  const baseUrl = voysConfig.api_base_url;
  const clientUuid = voysConfig.client_uuid;
  const callId = callRecord.voys_call_id;
  const token = voysConfig.api_token;

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "text/plain, application/json",
  };

  // Wait 30s for Voys to process (transcription not instantly available)
  await new Promise((r) => setTimeout(r, 30000));

  const updates: Record<string, any> = {};

  // Fetch transcription
  try {
    const transcRes = await fetch(
      `${baseUrl}/transcription-storage/clients/${clientUuid}/calls/${callId}/transcriptions`,
      { headers }
    );
    if (transcRes.ok) {
      const transcription = await transcRes.text();
      updates.transcription = transcription;
    }
  } catch (e) {
    console.error("Failed to fetch transcription:", e);
  }

  // Fetch summary
  if (voysConfig.fetch_summary) {
    try {
      const summaryRes = await fetch(
        `${baseUrl}/transcription-storage/clients/${clientUuid}/calls/${callId}/summaries`,
        { headers: { ...headers, Accept: "application/json" } }
      );
      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        updates.voys_summary = summaryData.summary;
      }
    } catch (e) {
      console.error("Failed to fetch summary:", e);
    }
  }

  // Enrich with AI if enabled and we have a transcription
  if (voysConfig.enrich_summary && updates.transcription) {
    try {
      const aiResult = await enrichWithAI(updates.transcription);
      updates.ai_summary = aiResult.summary;
      updates.ai_action_items = aiResult.action_items;

      // Write enriched summary back to Voys
      if (aiResult.summary) {
        await fetch(
          `${baseUrl}/transcription-storage/clients/${clientUuid}/calls/${callId}/summaries`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ summary: aiResult.summary }),
          }
        );
      }
    } catch (e) {
      console.error("Failed to enrich with AI:", e);
    }
  }

  // Update call record
  if (Object.keys(updates).length > 0) {
    await supabase
      .from("call_records")
      .update(updates)
      .eq("id", callRecord.id);
  }
}

// AI enrichment - extract action items and create structured summary
async function enrichWithAI(transcription: string) {
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicKey) return { summary: null, action_items: [] };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: `Je bent een assistent die telefoongesprekken samenvat voor een bedrijf. Geef een korte samenvatting in het Nederlands en extraheer concrete actiepunten. Antwoord ALLEEN in JSON: {"summary": "...", "action_items": ["...", "..."]}`,
      messages: [
        {
          role: "user",
          content: `Vat dit telefoongesprek samen en geef actiepunten:\n\n${transcription}`,
        },
      ],
    }),
  });

  if (!res.ok) return { summary: null, action_items: [] };

  const data = await res.json();
  const text = data.content?.[0]?.text || "";

  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    return { summary: text, action_items: [] };
  }
}

// Trigger WhatsApp followup for missed calls
async function triggerMissedCallFollowup(
  supabase: any,
  companyId: string,
  customerId: string,
  phoneNumber: string,
  callRecordId: string
) {
  // Wait a bit to not overlap with potential voicemail
  await new Promise((r) => setTimeout(r, 60000));

  // Check if the call was answered in the meantime (e.g. callback)
  const { data: record } = await supabase
    .from("call_records")
    .select("status")
    .eq("id", callRecordId)
    .single();

  if (record?.status === "answered") return;

  // Trigger AI intake via existing edge function
  const aiIntakeUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-intake`;
  await fetch(aiIntakeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    },
    body: JSON.stringify({
      company_id: companyId,
      customer_id: customerId,
      phone_number: phoneNumber,
      trigger: "missed_call",
      call_record_id: callRecordId,
    }),
  });
}
