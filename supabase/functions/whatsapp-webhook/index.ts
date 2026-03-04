// whatsapp-webhook/index.ts — GEFIXED: multi-tenant lookup + signature verificatie + shared imports

import { corsHeaders, jsonRes, optionsResponse } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { verifyMetaSignature } from "../_shared/webhook-verify.ts";
import { findCustomerByPhone } from "../_shared/phone.ts";
import { logUsage } from "../_shared/usage.ts";
import { logEdgeFunctionError } from "../_shared/error-logger.ts";

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
  companyId: string,
  _filename?: string,
): Promise<string | null> {
  try {
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

    const fileRes = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!fileRes.ok) {
      console.error("Media download failed:", fileRes.status);
      return null;
    }
    const fileBuffer = await fileRes.arrayBuffer();

    const ext = extFromMime(mimeType);
    // Tenant-isolated path: {companyId}/{msgType}/{uuid}.{ext}
    const storagePath = `${companyId}/${msgType}/${crypto.randomUUID()}.${ext}`;

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

    return `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/whatsapp-media/${storagePath}`;
  } catch (err) {
    console.error("downloadAndStoreMedia error:", err);
    return null;
  }
}

function extractContent(msg: any): string | null {
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

// ─── MULTI-TENANT: Zoek company config op basis van phone_number_id ───
async function findConfigByPhoneNumberId(
  supabase: any,
  phoneNumberId: string
): Promise<{ company_id: string; access_token: string; webhook_secret?: string } | null> {
  // Eerst: probeer match op whatsapp_phone_number_id
  const { data } = await supabase
    .from("whatsapp_config")
    .select("company_id, access_token, webhook_secret")
    .eq("phone_number_id", phoneNumberId)
    .maybeSingle();

  if (data) return data;

  // Fallback voor legacy single-tenant: pak eerste config
  // TODO: verwijder deze fallback zodra alle tenants phone_number_id hebben
  console.warn(`No config for phone_number_id ${phoneNumberId}, falling back to first config`);
  const { data: fallback } = await supabase
    .from("whatsapp_config")
    .select("company_id, access_token, webhook_secret")
    .limit(1)
    .maybeSingle();

  return fallback;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const supabase = createAdminClient();

  // ─── Stap 1: Lees raw body voor signature verificatie ───
  const rawBody = await req.text();

  // ─── Stap 2: Bepaal verificatiemethode ───
  // Optie A: Meta native webhook → X-Hub-Signature-256
  // Optie B: SiteJob Connect proxy → X-Webhook-Secret
  const hubSignature = req.headers.get("X-Hub-Signature-256");
  const customSecret = req.headers.get("X-Webhook-Secret");

  if (hubSignature) {
    // Meta native: verifieer met app secret
    const appSecret = Deno.env.get("META_APP_SECRET");
    if (!appSecret) {
      console.error("META_APP_SECRET not configured");
      return new Response("Server misconfigured", { status: 500, headers: corsHeaders });
    }
    const isValid = await verifyMetaSignature(rawBody, hubSignature, appSecret);
    if (!isValid) {
      console.error("WhatsApp webhook: Meta signature verification failed");
      return new Response("Invalid signature", { status: 403, headers: corsHeaders });
    }
  } else if (customSecret) {
    // SiteJob Connect proxy: verifieer met stored/env secret
    // We checken tegen alle configs (multi-tenant) of env fallback
    const envSecret = Deno.env.get("WHATSAPP_WEBHOOK_SECRET");
    const { data: configs } = await supabase
      .from("whatsapp_config")
      .select("webhook_secret")
      .not("webhook_secret", "is", null);

    const validSecrets = [
      envSecret,
      ...(configs || []).map((c: any) => c.webhook_secret),
    ].filter(Boolean);

    if (!validSecrets.includes(customSecret)) {
      console.error("WhatsApp webhook: secret mismatch");
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
  } else {
    console.error("WhatsApp webhook: no signature or secret header");
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  // ─── Stap 2b: Lees optionele company_id uit query params ───
  const url = new URL(req.url);
  const queryCompanyId = url.searchParams.get("company_id");

  // ─── Stap 3: Parse en verwerk ───
  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400, headers: corsHeaders });
  }

  // Normalize: SiteJob Connect format vs Meta native format
  let entries: any[];
  if (Array.isArray(body.entry)) {
    entries = body.entry;
  } else if (Array.isArray(body.changes)) {
    entries = [body];
  } else {
    entries = [];
  }

  for (const entry of entries) {
    for (const change of entry.changes || []) {
      // ─── MULTI-TENANT: Zoek config op basis van phone_number_id uit payload ───
      const phoneNumberId = change.value?.metadata?.phone_number_id;
      let config: { company_id: string; access_token: string } | null = null;

      if (phoneNumberId) {
        config = await findConfigByPhoneNumberId(supabase, phoneNumberId);
      }

      // Fallback: gebruik company_id uit query parameter (unieke webhook URL per tenant)
      if (!config && queryCompanyId) {
        const { data } = await supabase
          .from("whatsapp_config")
          .select("company_id, access_token")
          .eq("company_id", queryCompanyId)
          .maybeSingle();
        if (data) config = data;
      }

      if (!config) {
        console.warn("Could not determine company for webhook event, skipping");
        continue;
      }

      const companyId = config.company_id;
      const accessToken = config.access_token;

      // ─── Inkomende berichten ───
      if (change.value?.messages) {
        for (const msg of change.value.messages) {
          // Zoek customer via shared phone helper
          const customer = await findCustomerByPhone(supabase, msg.from, companyId);

          // Download & store media als van toepassing
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
                companyId,
                mediaMeta.filename,
              );
            }
          }

          const content = extractContent(msg);
          const metadata = {
            ...msg,
            ...(mediaUrl ? { storage_url: mediaUrl } : {}),
          };

          const fromNumber = msg.from.replace(/[^0-9]/g, "");

          const { error } = await supabase.from("whatsapp_messages").upsert(
            {
              wamid: msg.id,
              direction: "incoming",
              from_number: fromNumber,
              content,
              type: msg.type,
              status: "received",
              customer_id: customer?.id || null,
              company_id: companyId,
              metadata,
            },
            { onConflict: "wamid" }
          );

          if (error) {
            console.error(`Message save error: ${error.message}`);
            await logEdgeFunctionError(supabase, "whatsapp-webhook", `Message save: ${error.message}`, { wamid: msg.id }, companyId);
          }
          else await logUsage(supabase, companyId, "whatsapp_received", { from: fromNumber, type: msg.type });
        }
      }

      // ─── Status updates (delivered, read, failed) ───
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
