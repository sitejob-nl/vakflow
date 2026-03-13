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
      const { name, category, language, parameter_format, components, library_template_name, library_template_button_inputs } = body;
      if (!name || !category || !language) {
        return jsonRes({ error: "Velden ontbreken: name, category, language" }, 400);
      }

      const payload: Record<string, unknown> = { name, category, language };

      // Library template support
      if (library_template_name) {
        payload.library_template_name = library_template_name;
        if (library_template_button_inputs) {
          payload.library_template_button_inputs = library_template_button_inputs;
        }
      } else {
        // Custom template — components required
        if (!components) {
          return jsonRes({ error: "components ontbreekt voor custom template" }, 400);
        }
        payload.components = components;
      }

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

    // === EDIT TEMPLATE ===
    if (action === "edit") {
      const { template_id, components, category } = body;
      if (!template_id) return jsonRes({ error: "template_id ontbreekt" }, 400);
      if (!components && !category) return jsonRes({ error: "Geef components of category op om te bewerken" }, 400);

      const payload: Record<string, unknown> = {};
      if (components) payload.components = components;
      if (category) payload.category = category;

      const metaRes = await fetch(
        `https://graph.facebook.com/v25.0/${template_id}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${config.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const result = await metaRes.json();
      if (!metaRes.ok) {
        console.error("Template edit error:", JSON.stringify(result));
        return jsonRes({ error: result.error?.message || "Template bewerken mislukt" }, metaRes.status);
      }
      return jsonRes({ success: true });
    }

    // === DELETE TEMPLATE ===
    if (action === "delete") {
      const { template_name, template_id } = body;
      if (!template_name) return jsonRes({ error: "template_name ontbreekt" }, 400);

      // If template_id provided, delete specific language variant; otherwise delete all
      let url = `https://graph.facebook.com/v25.0/${config.waba_id}/message_templates?name=${encodeURIComponent(template_name)}`;
      if (template_id) {
        url += `&hsm_id=${encodeURIComponent(template_id)}`;
      }

      const metaRes = await fetch(url, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${config.access_token}` },
      });
      const result = await metaRes.json();
      if (!metaRes.ok) {
        console.error("Template delete error:", JSON.stringify(result));
        return jsonRes({ error: result.error?.message || "Template verwijderen mislukt" }, metaRes.status);
      }
      return jsonRes({ success: true });
    }

    // === BROWSE LIBRARY ===
    if (action === "library") {
      const params = new URLSearchParams();
      if (body.search) params.set("search", body.search);
      if (body.topic) params.set("topic", body.topic);
      if (body.usecase) params.set("usecase", body.usecase);
      if (body.industry) params.set("industry", body.industry);
      if (body.language) params.set("language", body.language);
      params.set("limit", String(body.limit || 20));

      const metaRes = await fetch(
        `https://graph.facebook.com/v25.0/${config.waba_id}/message_template_library?${params}`,
        { headers: { Authorization: `Bearer ${config.access_token}` } }
      );
      const result = await metaRes.json();
      if (!metaRes.ok) {
        console.error("Template library error:", JSON.stringify(result));
        return jsonRes({ error: result.error?.message || "Library ophalen mislukt" }, metaRes.status);
      }
      return jsonRes({ templates: result.data || [], paging: result.paging || null });
    }

    return jsonRes({ error: "Onbekende actie. Gebruik 'create', 'edit', 'delete' of 'library'" }, 400);
  } catch (err: any) {
    if (err instanceof AuthError) return jsonRes({ error: err.message }, err.status);
    console.error("whatsapp-templates error:", err);
    return jsonRes({ error: err.message || "Internal error" }, 500);
  }
});
