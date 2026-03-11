import { jsonRes, optionsResponse } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { logEdgeFunctionError } from "../_shared/error-logger.ts";

/** Get an Exact Online access token via SiteJob Connect */
async function getExactToken(tenantId: string, webhookSecret: string): Promise<{ access_token: string; division: number; base_url: string } | null> {
  try {
    const res = await fetch("https://xeshjkznwdrxjjhbpisn.supabase.co/functions/v1/exact-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant_id: tenantId, secret: webhookSecret }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
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

    const supabaseAdmin = createAdminClient();

    // Verify webhook secret
    const { data: config } = await supabaseAdmin
      .from("exact_config")
      .select("id, webhook_secret, tenant_id, division")
      .eq("company_id", companyId)
      .maybeSingle();

    if (!config || config.webhook_secret !== webhookSecret) {
      console.error("Invalid webhook for company:", companyId);
      return jsonRes({ error: "Invalid secret" }, 403);
    }

    const body = await req.json();
    const { Topic, Division, Key, EventAction } = body;

    console.log(`Exact webhook: ${EventAction} ${Topic} key=${Key} division=${Division} company=${companyId}`);

    // Process SalesInvoice events — check payment status
    if (Topic === "SalesInvoices" && Key) {
      try {
        // Get a fresh access token
        const token = await getExactToken(config.tenant_id, config.webhook_secret);
        if (!token) {
          console.warn("exact-webhook: could not get token for invoice status check");
          return jsonRes({ ok: true, skipped: "no_token" });
        }

        // Fetch the invoice from Exact to check its current status
        const invoiceUrl = `${token.base_url}/api/v1/${token.division}/salesinvoice/SalesInvoices?$filter=InvoiceID eq guid'${Key}'&$select=InvoiceID,InvoiceNumber,Status,AmountDC,PaymentCondition`;
        const invRes = await fetch(invoiceUrl, {
          headers: { Authorization: `Bearer ${token.access_token}`, Accept: "application/json" },
        });

        if (invRes.ok) {
          const invData = await invRes.json();
          const invoice = invData?.d?.results?.[0] || invData?.d;

          if (invoice) {
            // Exact status: 20 = Open, 50 = Paid
            const isPaid = invoice.Status === 50;
            const invoiceNumber = invoice.InvoiceNumber;

            if (isPaid) {
              // Find the local invoice by exact_id and update
              const { data: localInv, error: findErr } = await supabaseAdmin
                .from("invoices")
                .select("id, status")
                .eq("exact_id", Key)
                .eq("company_id", companyId)
                .maybeSingle();

              if (localInv && localInv.status !== "betaald") {
                await supabaseAdmin
                  .from("invoices")
                  .update({ status: "betaald", paid_at: new Date().toISOString().split("T")[0] })
                  .eq("id", localInv.id);
                console.log(`exact-webhook: invoice ${invoiceNumber || Key} → betaald`);
              }
            }
          }
        }
      } catch (err: any) {
        console.error("exact-webhook: invoice processing error:", err.message);
        await logEdgeFunctionError(supabaseAdmin, "exact-webhook", err.message, { company_id: companyId, key: Key, topic: Topic });
      }
    }

    return jsonRes({ ok: true });
  } catch (err: any) {
    console.error("exact-webhook error:", err);
    return jsonRes({ error: err.message || "Internal error" }, 500);
  }
});
