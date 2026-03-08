import { corsHeaders, jsonRes, optionsResponse } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { logEdgeFunctionError } from "../_shared/error-logger.ts";

/**
 * Moneybird Webhook Receiver
 * Receives POST from Moneybird with event payloads.
 * verify_jwt = false — validates by matching administration_id to a known company.
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonRes({ error: "Method not allowed" }, 405);

  const supabaseAdmin = createAdminClient();

  try {
    const payload = await req.json();

    // Moneybird webhook payload structure:
    // { "entity": "SalesInvoice", "entity_id": "123", "state": "paid", "action": "sales_invoice_state_changed", "administration_id": 123 }
    const { entity, entity_id, state, action, administration_id } = payload;

    if (!administration_id || !entity_id) {
      return jsonRes({ error: "Missing administration_id or entity_id" }, 400);
    }

    const adminIdStr = String(administration_id);

    // Lookup company by moneybird_administration_id
    const { data: company, error: companyErr } = await supabaseAdmin
      .from("companies")
      .select("id, moneybird_api_token, moneybird_administration_id")
      .eq("moneybird_administration_id", adminIdStr)
      .maybeSingle();

    if (companyErr || !company) {
      console.warn(`moneybird-webhook: unknown administration_id ${adminIdStr}`);
      return jsonRes({ ok: true, skipped: "unknown_administration" });
    }

    const companyId = company.id;
    const mbEntityId = String(entity_id);

    console.log(`moneybird-webhook: company=${companyId} action=${action} entity=${entity} entity_id=${mbEntityId} state=${state}`);

    // Handle sales invoice events
    if (entity === "SalesInvoice" && (action === "sales_invoice_state_changed" || action === "sales_invoice_updated")) {
      const stateMap: Record<string, string> = {
        draft: "concept",
        open: "verzonden",
        scheduled: "verzonden",
        pending_payment: "verzonden",
        late: "verzonden",
        reminded: "verzonden",
        paid: "betaald",
        uncollectible: "oninbaar",
      };

      const newStatus = stateMap[state] || null;
      if (newStatus) {
        const updateData: Record<string, unknown> = { status: newStatus };
        if (state === "paid") {
          updateData.paid_at = new Date().toISOString().split("T")[0];
        }
        const { error: updErr } = await supabaseAdmin
          .from("invoices")
          .update(updateData)
          .eq("moneybird_id", mbEntityId)
          .eq("company_id", companyId);
        if (updErr) {
          console.error(`moneybird-webhook: invoice update error`, updErr.message);
        } else {
          console.log(`moneybird-webhook: invoice ${mbEntityId} → ${newStatus}`);
        }
      }
    }

    // Handle estimate events
    if (entity === "Estimate" && (action === "estimate_state_changed" || action === "estimate_updated")) {
      const stateMap: Record<string, string> = {
        draft: "concept",
        open: "verzonden",
        late: "verzonden",
        accepted: "geaccepteerd",
        rejected: "afgewezen",
        billed: "geaccepteerd",
      };

      const newStatus = stateMap[state] || null;
      if (newStatus) {
        const { error: updErr } = await supabaseAdmin
          .from("quotes")
          .update({ status: newStatus })
          .eq("moneybird_id", mbEntityId)
          .eq("company_id", companyId);
        if (updErr) {
          console.error(`moneybird-webhook: quote update error`, updErr.message);
        } else {
          console.log(`moneybird-webhook: quote ${mbEntityId} → ${newStatus}`);
        }
      }
    }

    // Handle contact events
    if (entity === "Contact" && (action === "contact_changed" || action === "contact_updated")) {
      // We just log it; full contact sync would require fetching the contact from MB API
      console.log(`moneybird-webhook: contact ${mbEntityId} changed (not auto-syncing details)`);
    }

    return jsonRes({ ok: true });
  } catch (err: any) {
    console.error("moneybird-webhook error:", err.message);
    await logEdgeFunctionError(supabaseAdmin, "moneybird-webhook", err.message, { stack: err.stack });
    return jsonRes({ error: err.message }, 500);
  }
});
