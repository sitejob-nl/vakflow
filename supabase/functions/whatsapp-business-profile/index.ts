import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const API_VERSION = "v25.0";

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function authenticate(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data, error } = await supabaseUser.auth.getClaims(
    authHeader.replace("Bearer ", "")
  );
  if (error || !data?.claims) return null;
  return data.claims.sub as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonRes({ error: "Method not allowed" }, 405);
  }

  const userId = await authenticate(req);
  if (!userId) return jsonRes({ error: "Niet ingelogd" }, 401);

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: config } = await supabaseAdmin
    .from("whatsapp_config")
    .select("*")
    .single();

  if (!config?.access_token || !config?.phone_number_id) {
    return jsonRes({ error: "WhatsApp niet gekoppeld" }, 400);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "get";

    // === GET PROFILE ===
    if (action === "get") {
      const url = `https://graph.facebook.com/${API_VERSION}/${config.phone_number_id}/whatsapp_business_profile?fields=about,address,description,email,profile_picture_url,websites,vertical`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${config.access_token}` },
      });
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
      if (body.websites !== undefined) {
        payload.websites = body.websites;
      }

      const url = `https://graph.facebook.com/${API_VERSION}/${config.phone_number_id}/whatsapp_business_profile`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.access_token}`,
          "Content-Type": "application/json",
        },
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
      if (!file_base64) {
        return jsonRes({ error: "file_base64 ontbreekt" }, 400);
      }

      // Decode base64 to binary
      const binaryStr = atob(file_base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const mimeType = file_type || "image/jpeg";

      // Step 1: Create upload session
      const sessionUrl = `https://graph.facebook.com/${API_VERSION}/app/uploads?file_length=${bytes.length}&file_type=${encodeURIComponent(mimeType)}&file_name=${encodeURIComponent(file_name || "profile.jpg")}`;
      const sessionRes = await fetch(sessionUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.access_token}` },
      });
      const sessionResult = await sessionRes.json();
      if (!sessionRes.ok) {
        console.error("Upload session error:", JSON.stringify(sessionResult));
        return jsonRes({ error: sessionResult.error?.message || "Upload sessie mislukt" }, sessionRes.status);
      }

      // Step 2: Upload file data
      const uploadUrl = `https://graph.facebook.com/${API_VERSION}/${sessionResult.id}`;
      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          Authorization: `OAuth ${config.access_token}`,
          "Content-Type": mimeType,
          file_offset: "0",
        },
        body: bytes,
      });
      const uploadResult = await uploadRes.json();
      if (!uploadRes.ok) {
        console.error("Upload error:", JSON.stringify(uploadResult));
        return jsonRes({ error: uploadResult.error?.message || "Bestand uploaden mislukt" }, uploadRes.status);
      }

      // Step 3: Set profile picture handle
      const profileUrl = `https://graph.facebook.com/${API_VERSION}/${config.phone_number_id}/whatsapp_business_profile`;
      const profileRes = await fetch(profileUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          profile_picture_handle: uploadResult.h,
        }),
      });
      const profileResult = await profileRes.json();
      if (!profileRes.ok) {
        console.error("Profile picture update error:", JSON.stringify(profileResult));
        return jsonRes({ error: profileResult.error?.message || "Profielfoto instellen mislukt" }, profileRes.status);
      }

      return jsonRes({ success: true });
    }

    return jsonRes({ error: "Onbekende actie. Gebruik 'get', 'update' of 'upload_photo'" }, 400);
  } catch (error) {
    console.error("Business profile error:", error);
    return jsonRes({ error: error.message || "Onverwachte fout" }, 500);
  }
});
