import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

  if (!config?.access_token || !config?.waba_id) {
    return jsonRes({ error: "WhatsApp niet gekoppeld of WABA ID ontbreekt" }, 400);
  }

  const body = await req.json();
  const { action } = body;

  // === CREATE TEMPLATE ===
  if (action === "create") {
    const { name, category, language, parameter_format, components } = body;

    if (!name || !category || !language || !components) {
      return jsonRes({ error: "Velden ontbreken: name, category, language, components" }, 400);
    }

    const payload: Record<string, unknown> = { name, category, language, components };
    if (parameter_format) payload.parameter_format = parameter_format;

    const metaRes = await fetch(
      `https://graph.facebook.com/v25.0/${config.waba_id}/message_templates`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const result = await metaRes.json();
    if (!metaRes.ok) {
      console.error("Template create error:", JSON.stringify(result));
      return jsonRes({ error: result.error?.message || "Template aanmaken mislukt" }, metaRes.status);
    }

    return jsonRes({ success: true, template: result });
  }

  // === DELETE TEMPLATE ===
  if (action === "delete") {
    const { template_name } = body;
    if (!template_name) return jsonRes({ error: "template_name ontbreekt" }, 400);

    const metaRes = await fetch(
      `https://graph.facebook.com/v25.0/${config.waba_id}/message_templates?name=${encodeURIComponent(template_name)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${config.access_token}` },
      }
    );

    const result = await metaRes.json();
    if (!metaRes.ok) {
      console.error("Template delete error:", JSON.stringify(result));
      return jsonRes({ error: result.error?.message || "Template verwijderen mislukt" }, metaRes.status);
    }

    return jsonRes({ success: true });
  }

  return jsonRes({ error: "Onbekende actie. Gebruik 'create' of 'delete'" }, 400);
});
