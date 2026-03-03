import { jsonRes, optionsResponse } from "../_shared/cors.ts";
import { createAdminClient, authenticateRequest, AuthError } from "../_shared/supabase.ts";

const API_VERSION = "v25.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonRes({ error: "Method not allowed" }, 405);

  try {
    await authenticateRequest(req);
    const supabaseAdmin = createAdminClient();

    const { data: config } = await supabaseAdmin.from("whatsapp_config").select("*").single();
    if (!config?.access_token || !config?.phone_number_id) {
      return jsonRes({ error: "WhatsApp niet gekoppeld" }, 400);
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || "get";

    // === GET PROFILE ===
    if (action === "get") {
      const url = `https://graph.facebook.com/${API_VERSION}/${config.phone_number_id}/whatsapp_business_profile?fields=about,address,description,email,profile_picture_url,websites,vertical`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${config.access_token}` } });
      const result = await res.json();
      if (!res.ok) {
        console.error("Profile get error:", JSON.stringify(result));
        return jsonRes({ error: result.error?.message || "Profiel ophalen mislukt" }, res.status);
      }
      return jsonRes(result.data?.[0] || {});
    }

    // === UPDATE PROFILE ===
    if (action === "update") {
      const payload: Record<string, unknown> = { messaging_product: "whatsapp" };
      const fields = ["about", "address", "description", "email", "vertical"];
      for (const f of fields) {
        if (body[f] !== undefined) payload[f] = body[f];
      }
      if (body.websites !== undefined) payload.websites = body.websites;

      const url = `https://graph.facebook.com/${API_VERSION}/${config.phone_number_id}/whatsapp_business_profile`;
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) {
        console.error("Profile update error:", JSON.stringify(result));
        return jsonRes({ error: result.error?.message || "Profiel bijwerken mislukt" }, res.status);
      }
      return jsonRes({ success: true });
    }

    // === UPLOAD PROFILE PICTURE ===
    if (action === "upload_photo") {
      const { file_base64, file_type, file_name } = body;
      if (!file_base64) return jsonRes({ error: "file_base64 ontbreekt" }, 400);

      const binaryStr = atob(file_base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
      const mimeType = file_type || "image/jpeg";

      const sessionUrl = `https://graph.facebook.com/${API_VERSION}/app/uploads?file_length=${bytes.length}&file_type=${encodeURIComponent(mimeType)}&file_name=${encodeURIComponent(file_name || "profile.jpg")}`;
      const sessionRes = await fetch(sessionUrl, { method: "POST", headers: { Authorization: `Bearer ${config.access_token}` } });
      const sessionResult = await sessionRes.json();
      if (!sessionRes.ok) {
        console.error("Upload session error:", JSON.stringify(sessionResult));
        return jsonRes({ error: sessionResult.error?.message || "Upload sessie mislukt" }, sessionRes.status);
      }

      const uploadUrl = `https://graph.facebook.com/${API_VERSION}/${sessionResult.id}`;
      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers: { Authorization: `OAuth ${config.access_token}`, "Content-Type": mimeType, file_offset: "0" },
        body: bytes,
      });
      const uploadResult = await uploadRes.json();
      if (!uploadRes.ok) {
        console.error("Upload error:", JSON.stringify(uploadResult));
        return jsonRes({ error: uploadResult.error?.message || "Bestand uploaden mislukt" }, uploadRes.status);
      }

      const profileUrl = `https://graph.facebook.com/${API_VERSION}/${config.phone_number_id}/whatsapp_business_profile`;
      const profileRes = await fetch(profileUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", profile_picture_handle: uploadResult.h }),
      });
      const profileResult = await profileRes.json();
      if (!profileRes.ok) {
        console.error("Profile picture update error:", JSON.stringify(profileResult));
        return jsonRes({ error: profileResult.error?.message || "Profielfoto instellen mislukt" }, profileRes.status);
      }
      return jsonRes({ success: true });
    }

    return jsonRes({ error: "Onbekende actie. Gebruik 'get', 'update' of 'upload_photo'" }, 400);
  } catch (err: any) {
    if (err instanceof AuthError) return jsonRes({ error: err.message }, err.status);
    console.error("Business profile error:", err);
    return jsonRes({ error: err.message || "Onverwachte fout" }, 500);
  }
});