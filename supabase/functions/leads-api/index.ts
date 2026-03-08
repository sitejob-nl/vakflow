// leads-api/index.ts — Public REST API for leads (API key auth)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, corsFor, jsonRes, optionsResponse } from "../_shared/cors.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { logUsage } from "../_shared/usage.ts";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

/** SHA-256 hash a string and return hex */
async function sha256(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Authenticate request via X-API-Key header */
async function authenticate(req: Request): Promise<{ companyId: string } | Response> {
  const apiKey = req.headers.get("X-API-Key") || req.headers.get("x-api-key");
  if (!apiKey) {
    return jsonRes({ error: "Missing X-API-Key header" }, 401, req);
  }

  const keyHash = await sha256(apiKey);

  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .select("company_id")
    .eq("key_hash", keyHash)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) {
    return jsonRes({ error: "Invalid or inactive API key" }, 401, req);
  }

  // Update last_used_at (fire-and-forget)
  supabaseAdmin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("key_hash", keyHash)
    .then(() => {});

  return { companyId: data.company_id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);

  try {
    // Authenticate
    const authResult = await authenticate(req);
    if (authResult instanceof Response) return authResult;
    const { companyId } = authResult;

    // Rate limit: 60 req/min
    await checkRateLimit(supabaseAdmin, companyId, "leads_api", 60, 60);
    logUsage(supabaseAdmin, companyId, "leads_api");

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const method = req.method;

    // GET — list or single
    if (method === "GET") {
      if (id) {
        const { data, error } = await supabaseAdmin
          .from("leads")
          .select("*, lead_statuses(name, color)")
          .eq("id", id)
          .eq("company_id", companyId)
          .maybeSingle();

        if (error) return jsonRes({ error: error.message }, 400, req);
        if (!data) return jsonRes({ error: "Lead not found" }, 404, req);
        return jsonRes({ data }, 200, req);
      }

      // List with optional filters
      const status = url.searchParams.get("status");
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
      const offset = parseInt(url.searchParams.get("offset") || "0");

      let query = supabaseAdmin
        .from("leads")
        .select("*, lead_statuses(name, color)", { count: "exact" })
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) {
        // Filter by status name via subquery
        const { data: statusRow } = await supabaseAdmin
          .from("lead_statuses")
          .select("id")
          .eq("company_id", companyId)
          .eq("name", status)
          .maybeSingle();
        if (statusRow) query = query.eq("status_id", statusRow.id);
      }

      const { data, error, count } = await query;
      if (error) return jsonRes({ error: error.message }, 400, req);
      return jsonRes({ data, count }, 200, req);
    }

    // POST — create lead
    if (method === "POST") {
      const body = await req.json();
      const { name, email, phone, company_name, notes, source, value, status, custom_fields } = body;

      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return jsonRes({ error: "Field 'name' is required" }, 400, req);
      }
      if (name.length > 200) return jsonRes({ error: "name too long (max 200)" }, 400, req);
      if (email && email.length > 255) return jsonRes({ error: "email too long (max 255)" }, 400, req);

      // Resolve status_id — use provided status name or default to first status
      let statusId: string | null = null;
      if (status) {
        const { data: statusRow } = await supabaseAdmin
          .from("lead_statuses")
          .select("id")
          .eq("company_id", companyId)
          .eq("name", status)
          .maybeSingle();
        statusId = statusRow?.id || null;
      }
      if (!statusId) {
        const { data: defaultStatus } = await supabaseAdmin
          .from("lead_statuses")
          .select("id")
          .eq("company_id", companyId)
          .order("sort_order", { ascending: true })
          .limit(1)
          .maybeSingle();
        statusId = defaultStatus?.id || null;
      }
      if (!statusId) return jsonRes({ error: "No lead statuses configured" }, 400, req);

      const { data, error } = await supabaseAdmin.from("leads").insert({
        company_id: companyId,
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        company_name: company_name?.trim() || null,
        notes: notes?.trim() || null,
        source: source?.trim() || "api",
        value: typeof value === "number" ? value : null,
        status_id: statusId,
        custom_fields: custom_fields || null,
      }).select("*, lead_statuses(name, color)").single();

      if (error) return jsonRes({ error: error.message }, 400, req);
      return jsonRes({ data }, 201, req);
    }

    // PATCH — update lead
    if (method === "PATCH") {
      if (!id) return jsonRes({ error: "Query param 'id' is required for PATCH" }, 400, req);

      const body = await req.json();
      const updates: Record<string, unknown> = {};

      for (const field of ["name", "email", "phone", "company_name", "notes", "source"] as const) {
        if (body[field] !== undefined) updates[field] = body[field]?.trim() || null;
      }
      if (body.value !== undefined) updates.value = typeof body.value === "number" ? body.value : null;
      if (body.custom_fields !== undefined) updates.custom_fields = body.custom_fields;

      if (body.status) {
        const { data: statusRow } = await supabaseAdmin
          .from("lead_statuses")
          .select("id")
          .eq("company_id", companyId)
          .eq("name", body.status)
          .maybeSingle();
        if (statusRow) updates.status_id = statusRow.id;
      }

      if (Object.keys(updates).length === 0) {
        return jsonRes({ error: "No valid fields to update" }, 400, req);
      }

      const { data, error } = await supabaseAdmin
        .from("leads")
        .update(updates)
        .eq("id", id)
        .eq("company_id", companyId)
        .select("*, lead_statuses(name, color)")
        .maybeSingle();

      if (error) return jsonRes({ error: error.message }, 400, req);
      if (!data) return jsonRes({ error: "Lead not found" }, 404, req);
      return jsonRes({ data }, 200, req);
    }

    // DELETE
    if (method === "DELETE") {
      if (!id) return jsonRes({ error: "Query param 'id' is required for DELETE" }, 400, req);

      const { error, count } = await supabaseAdmin
        .from("leads")
        .delete({ count: "exact" })
        .eq("id", id)
        .eq("company_id", companyId);

      if (error) return jsonRes({ error: error.message }, 400, req);
      if (!count) return jsonRes({ error: "Lead not found" }, 404, req);
      return jsonRes({ success: true }, 200, req);
    }

    return jsonRes({ error: `Method ${method} not allowed` }, 405, req);
  } catch (err) {
    if (err.name === "RateLimitError") {
      return jsonRes({ error: err.message }, 429, req);
    }
    console.error("leads-api error:", err);
    return jsonRes({ error: "Internal server error" }, 500, req);
  }
});
