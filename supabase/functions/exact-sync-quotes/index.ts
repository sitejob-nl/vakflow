// exact-sync-quotes — Push offertes + pull status van Exact Online
// Vakflow: quotes.items (JSON), company_id

import { jsonRes, optionsResponse } from "../_shared/cors.ts";
import { createAdminClient, authenticateRequest, AuthError } from "../_shared/supabase.ts";
import { getExactTokenFromConnection } from "../_shared/exact-connect.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);

  try {
    const { companyId } = await authenticateRequest(req);
    const admin = createAdminClient();
    const { action, divisionId, quoteId } = await req.json();
    if (!divisionId) throw new Error("divisionId is required");

    const { data: connection, error: connError } = await admin
      .from("exact_online_connections").select("*")
      .eq("division_id", divisionId).eq("is_active", true).single();
    if (connError || !connection) throw new Error("Geen actieve Exact Online verbinding gevonden");

    const { access_token, base_url, division } = await getExactTokenFromConnection(connection);

    let result;
    if (action === "push") {
      result = await pushQuotes(admin, access_token, base_url, division, companyId, quoteId);
    } else if (action === "pull_status") {
      result = await pullQuoteStatus(admin, access_token, base_url, division, companyId);
    } else {
      throw new Error("Invalid action. Use 'push' or 'pull_status'");
    }
    return jsonRes(result, 200, req);
  } catch (err: any) {
    if (err instanceof AuthError) return jsonRes({ error: err.message }, err.status, req);
    console.error("exact-sync-quotes error:", err);
    return jsonRes({ error: err.message }, 500, req);
  }
});

// deno-lint-ignore no-explicit-any
async function pushQuotes(supabase: any, accessToken: string, baseUrl: string, exactDivision: number, companyId: string, quoteId?: string) {
  const results = { success: true, created: 0, skipped: 0, failed: 0, errors: [] as string[] };

  let query = supabase.from("quotes").select("*, customers(name, exact_account_id)").eq("company_id", companyId);
  if (quoteId) query = query.eq("id", quoteId);
  else query = query.is("exact_id", null);

  const { data: quotes, error } = await query;
  if (error) throw error;

  for (const quote of (quotes || [])) {
    try {
      const customer = quote.customers;
      if (!customer?.exact_account_id) {
        results.skipped++;
        results.errors.push(`Offerte ${quote.quote_number}: Klant niet gekoppeld aan Exact`);
        continue;
      }

      const items = (quote.items as any[]) || [];
      // deno-lint-ignore no-explicit-any
      const quotationLines = items.map((item: any) => ({
        Description: (item.description || item.omschrijving || "").substring(0, 100),
        Quantity: item.quantity || item.aantal || 1,
        UnitPrice: item.unit_price || item.prijs || 0,
      }));

      if (quotationLines.length === 0) {
        results.skipped++;
        results.errors.push(`Offerte ${quote.quote_number}: Geen regels`);
        continue;
      }

      // deno-lint-ignore no-explicit-any
      const quotation: any = {
        OrderAccount: customer.exact_account_id,
        Description: (`Offerte ${quote.quote_number}`).substring(0, 100),
        Currency: "EUR",
        QuotationLines: quotationLines,
      };
      if (quote.created_at) quotation.QuotationDate = quote.created_at.split("T")[0];

      const res = await fetch(`${baseUrl}/api/v1/${exactDivision}/crm/Quotations`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(quotation),
      });

      if (!res.ok) {
        results.failed++;
        results.errors.push(`Offerte ${quote.quote_number}: ${await res.text()}`);
      } else {
        const data = await res.json();
        const quotationId = data.d?.QuotationID;
        if (quotationId) {
          // Store in the existing exact_id field (or a new field if needed)
          // For now we don't have a dedicated field, so we skip updating
          // TODO: add exact_quotation_id to quotes table if needed
        }
        results.created++;
      }
    } catch (err) {
      results.failed++;
      results.errors.push(`Offerte ${quote.quote_number}: ${String(err)}`);
    }
  }
  return results;
}

// deno-lint-ignore no-explicit-any
async function pullQuoteStatus(supabase: any, accessToken: string, baseUrl: string, exactDivision: number, companyId: string) {
  const results = { success: true, updated: 0, skipped: 0, errors: [] as string[] };

  // We can only pull status for quotes we know the Exact ID of
  // Since we currently don't store exact_quotation_id, this is a no-op for now
  console.log("pullQuoteStatus: no exact_quotation_id field yet, skipping for company", companyId);
  return results;
}
