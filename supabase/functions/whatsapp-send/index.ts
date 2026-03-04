import { corsHeaders, jsonRes, optionsResponse } from "../_shared/cors.ts";
import { createAdminClient, authenticateRequest, AuthError } from "../_shared/supabase.ts";
import { normalizePhone, findCustomerByPhone } from "../_shared/phone.ts";
import { logUsage } from "../_shared/usage.ts";
import { logEdgeFunctionError } from "../_shared/error-logger.ts";

/** Build the Meta API request body for any supported message type */
function buildMetaBody(body: Record<string, unknown>, normalizedTo: string): Record<string, unknown> {
  const { type = "text" } = body;
  const metaBody: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to: normalizedTo,
  };

  if (body.context_message_id) {
    metaBody.context = { message_id: body.context_message_id };
  }

  switch (type) {
    case "text":
      metaBody.type = "text";
      metaBody.text = { body: body.message, preview_url: body.preview_url ?? false };
      break;
    case "template":
      metaBody.type = "template";
      metaBody.template = body.template;
      break;
    case "image":
      metaBody.type = "image";
      metaBody.image = body.media_id
        ? { id: body.media_id, caption: body.caption }
        : { link: body.message || body.link, caption: body.caption };
      break;
    case "video":
      metaBody.type = "video";
      metaBody.video = body.media_id
        ? { id: body.media_id, caption: body.caption }
        : { link: body.link, caption: body.caption };
      break;
    case "audio":
      metaBody.type = "audio";
      metaBody.audio = body.media_id ? { id: body.media_id } : { link: body.link };
      break;
    case "document":
      metaBody.type = "document";
      metaBody.document = body.media_id
        ? { id: body.media_id, caption: body.caption, filename: body.filename }
        : { link: body.link, caption: body.caption, filename: body.filename };
      break;
    case "sticker":
      metaBody.type = "sticker";
      metaBody.sticker = body.media_id ? { id: body.media_id } : { link: body.link };
      break;
    case "location":
      metaBody.type = "location";
      metaBody.location = { latitude: body.latitude, longitude: body.longitude, name: body.name, address: body.address };
      break;
    case "contacts":
      metaBody.type = "contacts";
      metaBody.contacts = body.contacts;
      break;
    case "reaction":
      metaBody.type = "reaction";
      metaBody.reaction = { message_id: body.reaction_message_id, emoji: body.emoji ?? "" };
      break;
    case "interactive":
      metaBody.type = "interactive";
      metaBody.interactive = body.interactive;
      break;
    default:
      throw new Error(`Onbekend berichttype: ${type}`);
  }

  return metaBody;
}

function contentSummary(body: Record<string, unknown>): string {
  const t = (body.type as string) || "text";
  switch (t) {
    case "text": return body.message as string || "";
    case "template": return `Template: ${(body.template as any)?.name}`;
    case "image": return body.caption ? `📷 ${body.caption}` : "📷 Afbeelding";
    case "video": return body.caption ? `🎥 ${body.caption}` : "🎥 Video";
    case "audio": return "🎵 Audio";
    case "document": return `📄 ${body.filename || "Document"}`;
    case "sticker": return "🏷️ Sticker";
    case "location": return `📍 ${body.name || "Locatie"}`;
    case "contacts": return "👤 Contact";
    case "reaction": return `${body.emoji || "👍"}`;
    case "interactive": return "💬 Interactief bericht";
    default: return t;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonRes({ error: "Method not allowed" }, 405);

  try {
    const { userId, companyId } = await authenticateRequest(req);
    const supabaseAdmin = createAdminClient();

    const body = await req.json();

    // Haal config op (always scoped to company)
    if (!companyId) return jsonRes({ error: "company_id ontbreekt" }, 400);
    const { data: config } = await supabaseAdmin
      .from("whatsapp_config")
      .select("*")
      .eq("company_id", companyId)
      .single();

    // === DISCONNECT ===
    if (body.action === "disconnect") {
      await supabaseAdmin.from("whatsapp_config").delete().eq("company_id", companyId);
      return jsonRes({ ok: true });
    }

    // === STATUS CHECK ===
    if (body.action === "status") {
      if (!config) return jsonRes({ connected: false, tenant_id: null });
      const isPending = config.access_token === "pending" || config.phone_number_id === "pending";
      return jsonRes({
        connected: !isPending,
        phone: config.display_phone || null,
        tenant_id: config.tenant_id || null,
      });
    }

    // === TEMPLATES OPHALEN ===
    if (body.action === "templates") {
      if (!config?.waba_id) return jsonRes({ error: "Niet gekoppeld" }, 400);
      const res = await fetch(
        `https://graph.facebook.com/v25.0/${config.waba_id}/message_templates?limit=100&fields=name,language,category,status,components,quality_score,parameter_format`,
        { headers: { Authorization: `Bearer ${config.access_token}` } }
      );
      const data = await res.json();
      const templates = data.data?.map((t: any) => ({
        name: t.name, status: t.status, category: t.category,
        language: t.language, components: t.components,
        quality_score: t.quality_score || null,
        parameter_format: (t.parameter_format || "POSITIONAL").toUpperCase(),
      })) || [];
      return jsonRes({ templates });
    }

    // === MARK AS READ ===
    if (body.action === "mark_read") {
      if (!config) return jsonRes({ error: "WhatsApp niet gekoppeld" }, 400);
      const res = await fetch(
        `https://graph.facebook.com/v25.0/${config.phone_number_id}/messages`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${config.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: body.message_id }),
        }
      );
      const result = await res.json();
      if (!res.ok) {
        console.error("Mark read failed:", JSON.stringify(result));
        return jsonRes({ error: "Markeren mislukt", code: "MARK_READ_FAILED" }, res.status);
      }
      if (body.message_id) {
        await supabaseAdmin.from("whatsapp_messages").update({ status: "read" }).eq("wamid", body.message_id);
      }
      return jsonRes({ ok: true });
    }

    // === TYPING INDICATOR ===
    if (body.action === "typing") {
      if (!config) return jsonRes({ error: "WhatsApp niet gekoppeld" }, 400);
      const normalizedTo = normalizePhone(body.to);
      const res = await fetch(
        `https://graph.facebook.com/v25.0/${config.phone_number_id}/messages`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${config.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: normalizedTo, type: "typing", typing: { state: "typing" } }),
        }
      );
      const result = await res.json();
      if (!res.ok) {
        console.error("Typing indicator failed:", JSON.stringify(result));
        return jsonRes({ error: "Typing indicator mislukt", code: "TYPING_FAILED" }, res.status);
      }
      return jsonRes({ ok: true });
    }

    // === BERICHT VERSTUREN ===
    if (!config) return jsonRes({ error: "WhatsApp niet gekoppeld" }, 400);

    // Rate limit: max 20 per minuut per gebruiker
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    const { count } = await supabaseAdmin
      .from("whatsapp_messages")
      .select("*", { count: "exact", head: true })
      .eq("sent_by", userId)
      .eq("direction", "outgoing")
      .gte("created_at", oneMinuteAgo);

    if ((count || 0) >= 20) {
      return jsonRes({ error: "Rate limit bereikt. Probeer het over een minuut opnieuw." }, 429);
    }

    const { to, customer_id, type = "text" } = body;
    const normalizedTo = normalizePhone(to);
    const isReaction = type === "reaction";

    let metaBody: Record<string, unknown>;
    try {
      metaBody = buildMetaBody(body, normalizedTo);
    } catch (e) {
      return jsonRes({ error: (e as Error).message }, 400);
    }

    const metaRes = await fetch(
      `https://graph.facebook.com/v25.0/${config.phone_number_id}/messages`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${config.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify(metaBody),
      }
    );

    const result = await metaRes.json();
    if (!metaRes.ok) {
      console.error("Meta API error:", JSON.stringify(result));
      return jsonRes({ error: "Bericht kon niet worden verstuurd", code: "META_SEND_FAILED" }, metaRes.status);
    }

    if (!isReaction && result.messages?.[0]?.id) {
      // Auto-resolve customer_id als die ontbreekt, op basis van telefoonnummer
      let resolvedCustomerId = customer_id || null;
      if (!resolvedCustomerId && companyId) {
        const found = await findCustomerByPhone(supabaseAdmin, normalizedTo, companyId);
        if (found) resolvedCustomerId = found.id;
      }

      await supabaseAdmin.from("whatsapp_messages").insert({
        wamid: result.messages[0].id,
        direction: "outgoing",
        to_number: normalizedTo,
        content: contentSummary(body),
        type,
        status: "sent",
        sent_by: userId,
        customer_id: resolvedCustomerId,
        company_id: companyId,
      });
      await logUsage(supabaseAdmin, companyId, "whatsapp_sent", { to: normalizedTo, type });
    }

    return jsonRes({ ok: true, ...result });
  } catch (err: any) {
    if (err instanceof AuthError) return jsonRes({ error: err.message }, err.status);
    console.error("whatsapp-send error:", err);
    const admin = createAdminClient();
    await logEdgeFunctionError(admin, "whatsapp-send", err.message || "Unknown error", { stack: err.stack });
    return jsonRes({ error: err.message || "Internal error" }, 500);
  }
});