import { jsonRes, optionsResponse } from "../_shared/cors.ts";
import { createAdminClient, authenticateRequest, AuthError } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonRes({ error: "Method not allowed" }, 405);

  try {
    const { companyId } = await authenticateRequest(req);
    const supabaseAdmin = createAdminClient();

    const { data: config } = await supabaseAdmin.from("whatsapp_config").select("*").eq("company_id", companyId).single();
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
          headers: { Authorization: `Bearer ${config.access_token}`, "Content-Type": "application/json" },
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
        { method: "DELETE", headers: { Authorization: `Bearer ${config.access_token}` } }
      );
      const result = await metaRes.json();
      if (!metaRes.ok) {
        console.error("Template delete error:", JSON.stringify(result));
        return jsonRes({ error: result.error?.message || "Template verwijderen mislukt" }, metaRes.status);
      }
      return jsonRes({ success: true });
    }

    return jsonRes({ error: "Onbekende actie. Gebruik 'create' of 'delete'" }, 400);
  } catch (err: any) {
    if (err instanceof AuthError) return jsonRes({ error: err.message }, err.status);
    console.error("whatsapp-templates error:", err);
    return jsonRes({ error: err.message || "Internal error" }, 500);
  }
});