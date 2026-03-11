import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getExactTokenFromConnection } from "../_shared/exact-connect.ts";
import { requireAuthOrService } from "../_shared/require-auth-or-service.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await requireAuthOrService(req);
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Missing Supabase configuration");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { action, divisionId, quoteId } = await req.json();
    if (!divisionId) throw new Error("divisionId is required");

    const { data: connection, error: connError } = await supabase
      .from("exact_online_connections").select("*")
      .eq("division_id", divisionId).eq("is_active", true).single();
    if (connError || !connection) throw new Error("No active Exact Online connection found");

    const tokenData = await getExactTokenFromConnection(connection);
    const { access_token: accessToken, base_url: baseUrl, division: exactDivision } = tokenData;

    let result;
    if (action === "push") {
      result = await pushQuotes(supabase, accessToken, baseUrl, exactDivision, divisionId, quoteId);
    } else if (action === "pull_status") {
      result = await pullQuoteStatus(supabase, accessToken, baseUrl, exactDivision, divisionId);
    } else {
      throw new Error("Invalid action. Use 'push' or 'pull_status'");
    }

    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Quote sync error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// deno-lint-ignore no-explicit-any
async function pushQuotes(supabase: any, accessToken: string, baseUrl: string, exactDivision: number, divisionId: string, quoteId?: string) {
  const results = { success: true, created: 0, skipped: 0, failed: 0, errors: [] as string[] };

  let query = supabase
    .from("quotes")
    .select(`
      id, quote_number, reference, quote_date, valid_until, status, division_id,
      exact_quotation_id, customer_id,
      customers!inner(exact_account_id, last_name, company_name),
      quote_lines(id, description, quantity, unit_price, is_group_header, product_id)
    `)
    .eq("division_id", divisionId);

  if (quoteId) {
    query = query.eq("id", quoteId);
  } else {
    query = query.is("exact_quotation_id", null);
  }

  const { data: quotes, error } = await query;
  if (error) throw error;

  // Pre-fetch product exact_item_ids
  const productIds = new Set<string>();
  for (const quote of (quotes || [])) {
    for (const line of (quote.quote_lines || [])) {
      if (line.product_id) productIds.add(line.product_id);
    }
  }
  const productItemMap = new Map<string, string>();
  if (productIds.size > 0) {
    const { data: products } = await supabase
      .from("products").select("id, exact_item_id")
      .in("id", Array.from(productIds)).not("exact_item_id", "is", null);
    for (const p of (products || [])) {
      if (p.exact_item_id) productItemMap.set(p.id, p.exact_item_id);
    }
  }

  for (const quote of (quotes || [])) {
    try {
      if (quote.exact_quotation_id && !quoteId) { results.skipped++; continue; }

      const customer = quote.customers;
      if (!customer?.exact_account_id) {
        results.skipped++;
        results.errors.push(`Offerte #${quote.quote_number}: Klant niet gekoppeld aan Exact`);
        continue;
      }

      // Build QuotationLines
      const quotationLines = [];
      for (const line of (quote.quote_lines || [])) {
        if (line.is_group_header) continue;
        // deno-lint-ignore no-explicit-any
        const ql: any = {
          Description: (line.description || "").substring(0, 100),
          Quantity: line.quantity || 1,
          UnitPrice: line.unit_price || 0,
        };
        const exactItemId = line.product_id ? productItemMap.get(line.product_id) : undefined;
        if (exactItemId) ql.Item = exactItemId;
        quotationLines.push(ql);
      }

      if (quotationLines.length === 0) {
        results.skipped++;
        results.errors.push(`Offerte #${quote.quote_number}: Geen regels`);
        continue;
      }

      // deno-lint-ignore no-explicit-any
      const quotation: any = {
        OrderAccount: customer.exact_account_id,
        Description: (quote.reference || `Offerte #${quote.quote_number}`).substring(0, 100),
        Currency: "EUR",
        QuotationLines: quotationLines,
      };
      if (quote.quote_date) quotation.QuotationDate = quote.quote_date;
      if (quote.valid_until) quotation.ClosingDate = quote.valid_until;

      const res = await fetch(`${baseUrl}/api/v1/${exactDivision}/crm/Quotations`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(quotation),
      });

      if (!res.ok) {
        results.failed++;
        results.errors.push(`Offerte #${quote.quote_number}: ${await res.text()}`);
      } else {
        const data = await res.json();
        const quotationId = data.d?.QuotationID;
        const quotationNumber = data.d?.QuotationNumber;
        if (quotationId) {
          await supabase.from("quotes").update({
            exact_quotation_id: quotationId,
            exact_quotation_number: quotationNumber?.toString() || null,
          }).eq("id", quote.id);
        }
        results.created++;
      }
    } catch (err) {
      results.failed++;
      results.errors.push(`Offerte #${quote.quote_number}: ${String(err)}`);
    }
  }

  return results;
}

// deno-lint-ignore no-explicit-any
async function pullQuoteStatus(supabase: any, accessToken: string, baseUrl: string, exactDivision: number, divisionId: string) {
  const results = { success: true, updated: 0, skipped: 0, errors: [] as string[] };

  const { data: quotes, error } = await supabase
    .from("quotes")
    .select("id, quote_number, exact_quotation_id, status")
    .eq("division_id", divisionId)
    .not("exact_quotation_id", "is", null);

  if (error) throw error;

  for (const quote of (quotes || [])) {
    try {
      const url = `${baseUrl}/api/v1/${exactDivision}/crm/Quotations(guid'${quote.exact_quotation_id}')?$select=QuotationID,StatusDescription,Status`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } });

      if (!res.ok) { await res.text(); results.skipped++; continue; }

      const data = await res.json();
      const exactStatus = data.d?.StatusDescription;

      // Map Exact status to local status
      let localStatus: string | null = null;
      if (exactStatus === "Accepted" || exactStatus === "Geaccepteerd") localStatus = "accepted";
      else if (exactStatus === "Rejected" || exactStatus === "Afgewezen") localStatus = "rejected";

      if (localStatus && localStatus !== quote.status) {
        await supabase.from("quotes").update({ status: localStatus }).eq("id", quote.id);
        results.updated++;
      } else {
        results.skipped++;
      }
    } catch (err) {
      results.errors.push(`Offerte #${quote.quote_number}: ${String(err)}`);
    }
  }

  return results;
}
