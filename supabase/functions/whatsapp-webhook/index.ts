import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[^0-9+]/g, "");
  if (cleaned.startsWith("06")) cleaned = "316" + cleaned.slice(2);
  if (cleaned.startsWith("00")) cleaned = cleaned.slice(2);
  if (cleaned.startsWith("+")) cleaned = cleaned.slice(1);
  return cleaned;
}

const MEDIA_TYPES = ["image", "video", "audio", "document", "sticker"];

function getMediaMeta(msg: any): { mediaId: string; mimeType: string; filename?: string } | null {
  const typeData = msg[msg.type];
  if (!typeData?.id) return null;
  return {
    mediaId: typeData.id,
    mimeType: typeData.mime_type || "application/octet-stream",
    filename: typeData.filename,
  };
}

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
    "video/mp4": "mp4", "video/3gpp": "3gp",
    "audio/aac": "aac", "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/amr": "amr",
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  };
  return map[mime] || mime.split("/")[1] || "bin";
}

async function downloadAndStoreMedia(
  supabase: any,
  accessToken: string,
  mediaId: string,
  mimeType: string,
  msgType: string,
  filename?: string,
): Promise<string | null> {
  try {
    // Step 1: Get the download URL from Meta
    const metaRes = await fetch(`https://graph.facebook.com/v25.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!metaRes.ok) {
      console.error("Meta media info failed:", metaRes.status, await metaRes.text());
      return null;
    }
    const metaData = await metaRes.json();
    const downloadUrl = metaData.url;
    if (!downloadUrl) return null;

    // Step 2: Download the actual binary
    const fileRes = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!fileRes.ok) {
      console.error("Media download failed:", fileRes.status);
      return null;
    }
    const fileBuffer = await fileRes.arrayBuffer();

    // Step 3: Upload to Supabase Storage
    const ext = extFromMime(mimeType);
    const storagePath = `${msgType}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("whatsapp-media")
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload failed:", uploadError);
      return null;
    }

    // Step 4: Return the storage path (not a public URL - bucket is private)
    // The frontend will generate signed URLs when displaying media
    return `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/whatsapp-media/${storagePath}`;
  } catch (err) {
    console.error("downloadAndStoreMedia error:", err);
    return null;
  }
}

function extractContent(msg: any, mediaUrl?: string | null): string | null {
  switch (msg.type) {
    case "text":
      return msg.text?.body || null;
    case "image":
      return msg.image?.caption || "[Afbeelding]";
    case "video":
      return msg.video?.caption || "[Video]";
    case "audio":
      return "[Audiobericht]";
    case "document":
      return msg.document?.caption || `[Document: ${msg.document?.filename || "bestand"}]`;
    case "sticker":
      return "[Sticker]";
    case "location":
      return `[Locatie: ${msg.location?.name || `${msg.location?.latitude}, ${msg.location?.longitude}`}]`;
    case "contacts":
      return `[Contact: ${msg.contacts?.[0]?.name?.formatted_name || "onbekend"}]`;
    case "reaction":
      return msg.reaction?.emoji || null;
    case "interactive":
      if (msg.interactive?.type === "button_reply") {
        return msg.interactive.button_reply?.title || "[Knop antwoord]";
      }
      if (msg.interactive?.type === "list_reply") {
        return msg.interactive.list_reply?.title || "[Lijst antwoord]";
      }
      return "[Interactief antwoord]";
    case "button":
      return msg.button?.text || "[Quick reply]";
    case "order":
      return `[Bestelling: ${msg.order?.product_items?.length || 0} producten]`;
    default:
      return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Verify webhook secret against stored value (fallback to env var)
  const incomingSecret = req.headers.get("X-Webhook-Secret");
  const { data: configForSecret } = await supabase
    .from("whatsapp_config")
    .select("webhook_secret")
    .limit(1)
    .maybeSingle();

  const storedSecret = configForSecret?.webhook_secret || Deno.env.get("WHATSAPP_WEBHOOK_SECRET");
  if (!incomingSecret || incomingSecret !== storedSecret) {
    console.error("Webhook secret mismatch");
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  // Fetch access token and company_id once for media downloads
  let accessToken: string | null = null;
  let webhookCompanyId: string | null = null;
  const { data: configRow } = await supabase
    .from("whatsapp_config")
    .select("access_token, company_id")
    .limit(1)
    .single();
  if (configRow) {
    accessToken = configRow.access_token;
    webhookCompanyId = configRow.company_id;
  }

  const body = await req.json();

  // Normalize: SiteJob Connect sends { id, changes: [...] }
  // Meta native format sends { entry: [{ id, changes: [...] }] }
  let entries: any[];
  if (Array.isArray(body.entry)) {
    entries = body.entry;
  } else if (Array.isArray(body.changes)) {
    // SiteJob Connect format: the body IS the entry object
    entries = [body];
  } else {
    entries = [];
  }

  for (const entry of entries) {
    for (const change of entry.changes || []) {
      // Inkomende berichten
      if (change.value?.messages) {
        for (const msg of change.value.messages) {
          const fromNumber = normalizePhone(msg.from);

          // Strict validation: fromNumber must only contain digits
          if (!/^\d+$/.test(fromNumber)) {
            console.warn("Invalid phone number skipped:", msg.from);
            continue;
          }

          // Try to match customer by phone (scoped to company if known)
          let customer: { id: string } | null = null;

          // Try exact match
          let custQuery = supabase
            .from("customers")
            .select("id")
            .eq("phone", fromNumber)
            .limit(1);
          if (webhookCompanyId) custQuery = custQuery.eq("company_id", webhookCompanyId);
          const { data: c1 } = await custQuery.maybeSingle();
          customer = c1;

          // Try with + prefix
          if (!customer) {
            let q2 = supabase
              .from("customers")
              .select("id")
              .eq("phone", `+${fromNumber}`)
              .limit(1);
            if (webhookCompanyId) q2 = q2.eq("company_id", webhookCompanyId);
            const { data: c2 } = await q2.maybeSingle();
            customer = c2;
          }

          // Try Dutch local format (0x instead of 31x)
          if (!customer && fromNumber.startsWith("316")) {
            let q3 = supabase
              .from("customers")
              .select("id")
              .eq("phone", `0${fromNumber.slice(2)}`)
              .limit(1);
            if (webhookCompanyId) q3 = q3.eq("company_id", webhookCompanyId);
            const { data: c3 } = await q3.maybeSingle();
            customer = c3;
          }

          // Download & store media if applicable
          let mediaUrl: string | null = null;
          if (MEDIA_TYPES.includes(msg.type) && accessToken) {
            const mediaMeta = getMediaMeta(msg);
            if (mediaMeta) {
              mediaUrl = await downloadAndStoreMedia(
                supabase,
                accessToken,
                mediaMeta.mediaId,
                mediaMeta.mimeType,
                msg.type,
                mediaMeta.filename,
              );
            }
          }

          const content = extractContent(msg, mediaUrl);

          // Store media_url in metadata alongside the raw message
          const metadata = {
            ...msg,
            ...(mediaUrl ? { storage_url: mediaUrl } : {}),
          };

          await supabase.from("whatsapp_messages").upsert(
            {
              wamid: msg.id,
              direction: "incoming",
              from_number: fromNumber,
              content,
              type: msg.type,
              status: "received",
              customer_id: customer?.id || null,
              company_id: webhookCompanyId,
              metadata,
            },
            { onConflict: "wamid" }
          );
        }
      }

      // Status updates (delivered, read, failed)
      if (change.value?.statuses) {
        for (const status of change.value.statuses) {
          const updateData: Record<string, unknown> = { status: status.status };
          if (status.status === "failed" && status.errors?.length) {
            updateData.metadata = {
              error_code: status.errors[0].code,
              error_title: status.errors[0].title,
            };
          }
          await supabase
            .from("whatsapp_messages")
            .update(updateData)
            .eq("wamid", status.id);
        }
      }
    }
  }

  return new Response("OK", { status: 200, headers: corsHeaders });
});
