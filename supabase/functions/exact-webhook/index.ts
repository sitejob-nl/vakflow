import { jsonRes, optionsResponse } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { logEdgeFunctionError } from "../_shared/error-logger.ts";

/** Get Exact Online access token via SiteJob Connect */
async function getExactToken(tenantId: string, secret: string): Promise<{ access_token: string; division: number; base_url: string } | null> {
  try {
    const res = await fetch("https://xeshjkznwdrxjjhbpisn.supabase.co/functions/v1/exact-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant_id: tenantId, secret }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  try {
    const webhookSecret = req.headers.get("x-webhook-secret");
    const url = new URL(req.url);
    const companyId = url.searchParams.get("company_id");

    if (!webhookSecret || !companyId) {
      return jsonRes({ error: "Missing webhook secret or company_id" }, 401);
    }

    const sb = createAdminClient();

    const { data: config } = await sb
      .from("exact_config")
      .select("id, webhook_secret, tenant_id, division")
      .eq("company_id", companyId)
      .maybeSingle();

    if (!config || config.webhook_secret !== webhookSecret) {
      console.error("Invalid webhook for company:", companyId);
      return jsonRes({ error: "Invalid secret" }, 403);
    }

    const body = await req.json();

    // Exact webhook payload: { Content: { Topic, Action, Key, Division, ... }, HashCode }
    // The raw body may be wrapped in Content/HashCode or flat — handle both
    const content = body.Content || body;
    const { Topic, Division, Key, Action: EventAction } = content;

    console.log(`exact-webhook: ${EventAction} ${Topic} key=${Key} div=${Division} company=${companyId}`);

    // Process SalesInvoice events — check payment via ReceivablesList
    if (Topic === "SalesInvoices" && Key) {
      try {
        const token = await getExactToken(config.tenant_id, config.webhook_secret);
        if (!token) {
          console.warn("exact-webhook: could not get token");
          return jsonRes({ ok: true, skipped: "no_token" });
        }

        // Find local invoice by exact_id
        const { data: localInv } = await sb
          .from("invoices")
          .select("id, invoice_number, status")
          .eq("exact_id", Key)
          .eq("company_id", companyId)
          .maybeSingle();

        if (!localInv || localInv.status === "betaald") {
          return jsonRes({ ok: true, skipped: "not_found_or_already_paid" });
        }

        // #1: Use ReceivablesList to check if invoice is paid
        // If the invoice_number is NOT in the receivables list, it's fully paid
        if (localInv.invoice_number) {
          const recvUrl = `${token.base_url}/api/v1/${token.division}/read/financial/ReceivablesList?$select=InvoiceNumber,Amount&$filter=InvoiceNumber eq '${localInv.invoice_number}'`;
          const recvRes = await fetch(recvUrl, {
            headers: { Authorization: `Bearer ${token.access_token}`, Accept: "application/json" },
          });

          if (recvRes.ok) {
            const recvData = await recvRes.json();
            const results = recvData?.d?.results || recvData?.d || [];
            const isOutstanding = Array.isArray(results) && results.length > 0;

            if (!isOutstanding) {
              // Not in receivables = fully paid
              await sb.from("invoices")
                .update({ status: "betaald", paid_at: new Date().toISOString().split("T")[0] })
                .eq("id", localInv.id);
              console.log(`exact-webhook: invoice ${localInv.invoice_number} → betaald`);
            }
          }
        }
      } catch (err: any) {
        console.error("exact-webhook: invoice processing error:", err.message);
        await logEdgeFunctionError(sb, "exact-webhook", err.message, { company_id: companyId, key: Key });
      }
    }

    return jsonRes({ ok: true });
  } catch (err: any) {
    console.error("exact-webhook error:", err);
    return jsonRes({ error: err.message || "Internal error" }, 500);
  }
});
