import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getExactTokenFromConnection } from "../_shared/exact-connect.ts";
import { requireAuthOrService } from "../_shared/require-auth-or-service.ts";

interface AbitareOrder {
  id: string;
  order_number: number;
  order_date: string | null;
  customer_id: string;
  total_excl_vat: number | null;
  total_vat: number | null;
  total_incl_vat: number | null;
  payment_status: string | null;
  amount_paid: number | null;
  exact_invoice_id: string | null;
  exact_sales_order_id: string | null;
  division_id: string | null;
  // deno-lint-ignore no-explicit-any
  customer?: any;
  // deno-lint-ignore no-explicit-any
  order_lines?: any[];
}

interface ExactSalesInvoiceLine {
  Item?: string;
  GLAccount?: string;
  Description: string;
  Quantity: number;
  NetPrice: number;
  VATCode: string;
}

interface ExactSalesInvoice {
  Journal: string;
  OrderedBy: string;
  Description?: string;
  YourRef?: string;
  Currency: string;
  InvoiceDate?: string;
  PaymentCondition?: string;
  SalesInvoiceLines: ExactSalesInvoiceLine[];
}

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
    const { action, divisionId, orderId } = await req.json();
    if (!divisionId) throw new Error("divisionId is required");

    const { data: connection, error: connError } = await supabase
      .from("exact_online_connections").select("*")
      .eq("division_id", divisionId).eq("is_active", true).single();

    if (connError || !connection) throw new Error("No active Exact Online connection found for this division");

    const tokenData = await getExactTokenFromConnection(connection);
    const accessToken = tokenData.access_token;
    const baseUrl = tokenData.base_url;
    const exactDivision = tokenData.division;

    if (action === "push") {
      return await pushInvoices(supabase, accessToken, baseUrl, exactDivision, divisionId, orderId);
    } else if (action === "pull_status") {
      return await pullPaymentStatus(supabase, accessToken, baseUrl, exactDivision, divisionId, orderId);
    } else if (action === "sync") {
      const pushResult = await pushInvoicesInternal(supabase, accessToken, baseUrl, exactDivision, divisionId, orderId);
      const pullResult = await pullPaymentStatusInternal(supabase, accessToken, baseUrl, exactDivision, divisionId);
      return new Response(JSON.stringify({ success: true, pushed: pushResult, pulled: pullResult }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      throw new Error("Invalid action. Use 'push', 'pull_status', or 'sync'");
    }
  } catch (error: unknown) {
    console.error("Invoice sync error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// deno-lint-ignore no-explicit-any
async function pushInvoices(supabase: any, accessToken: string, baseUrl: string, exactDivision: number, divisionId: string, orderId?: string): Promise<Response> {
  const result = await pushInvoicesInternal(supabase, accessToken, baseUrl, exactDivision, divisionId, orderId);
  return new Response(JSON.stringify(result), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// deno-lint-ignore no-explicit-any
async function pushInvoicesInternal(supabase: any, accessToken: string, baseUrl: string, exactDivision: number, divisionId: string, orderId?: string) {
  let query = supabase.from("orders").select(`
    id, order_number, order_date, customer_id, total_excl_vat, total_vat, total_incl_vat,
    payment_status, amount_paid, exact_invoice_id, exact_sales_order_id, division_id,
    customers!inner(exact_account_id, last_name, company_name),
    order_lines(id, description, quantity, unit_price, vat_rate, line_total, article_code, is_group_header, product_id)
  `).eq("division_id", divisionId);

  if (orderId) { query = query.eq("id", orderId); }
  else { query = query.is("exact_invoice_id", null); }

  const { data: orders, error } = await query;
  if (error) throw error;

  // Pre-fetch product exact_item_ids for all products in these orders
  const productIds = new Set<string>();
  for (const order of orders as AbitareOrder[]) {
    for (const line of (order.order_lines || [])) {
      if (line.product_id) productIds.add(line.product_id);
    }
  }

  const productItemMap = new Map<string, string>();
  if (productIds.size > 0) {
    const { data: products } = await supabase
      .from("products")
      .select("id, exact_item_id")
      .in("id", Array.from(productIds))
      .not("exact_item_id", "is", null);
    for (const p of (products || [])) {
      if (p.exact_item_id) productItemMap.set(p.id, p.exact_item_id);
    }
  }

  const results = { success: true, created: 0, skipped: 0, failed: 0, errors: [] as string[] };

  // Get journal and GL account once
  const journalCode = await getSalesInvoiceJournal(accessToken, baseUrl, exactDivision);
  const glAccountId = await getDefaultRevenueGLAccount(accessToken, baseUrl, exactDivision);

  for (const order of orders as AbitareOrder[]) {
    try {
      if (order.exact_invoice_id && !orderId) { results.skipped++; continue; }

      const customer = order.customer || (order as any).customers;
      let accountId = customer?.exact_account_id;

      if (!accountId) {
        accountId = await ensureCustomerInExact(supabase, accessToken, baseUrl, exactDivision, order.customer_id);
        if (!accountId) { results.skipped++; results.errors.push(`Order #${order.order_number}: Kon klant niet aanmaken in Exact Online`); continue; }
      }

      const exactInvoice = mapToExactSalesInvoice(order, accountId, glAccountId, journalCode, productItemMap);

      const response = await fetch(`${baseUrl}/api/v1/${exactDivision}/salesinvoice/SalesInvoices`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(exactInvoice),
      });

      if (!response.ok) {
        const errorText = await response.text();
        results.failed++;
        results.errors.push(`Order #${order.order_number}: ${errorText}`);
      } else {
        const data = await response.json();
        const invoiceId = data.d?.InvoiceID;
        const invoiceNumber = data.d?.InvoiceNumber;
        if (invoiceId) {
          await supabase.from("orders").update({
            exact_invoice_id: invoiceId,
          }).eq("id", order.id);
        }
        console.log(`Invoice created for order #${order.order_number}: InvoiceID=${invoiceId}, InvoiceNumber=${invoiceNumber}`);
        results.created++;
      }
    } catch (err) {
      results.failed++;
      results.errors.push(`Order #${order.order_number}: ${String(err)}`);
    }
  }

  return results;
}

// deno-lint-ignore no-explicit-any
async function pullPaymentStatus(supabase: any, accessToken: string, baseUrl: string, exactDivision: number, divisionId: string, orderId?: string): Promise<Response> {
  const result = await pullPaymentStatusInternal(supabase, accessToken, baseUrl, exactDivision, divisionId, orderId);
  return new Response(JSON.stringify(result), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// deno-lint-ignore no-explicit-any
async function pullPaymentStatusInternal(supabase: any, accessToken: string, baseUrl: string, exactDivision: number, divisionId: string, orderId?: string) {
  const results = { success: true, updated: 0, skipped: 0, errors: [] as string[] };

  let query = supabase.from("orders")
    .select("id, order_number, exact_invoice_id, total_incl_vat, amount_paid, payment_status")
    .eq("division_id", divisionId).not("exact_invoice_id", "is", null);
  if (orderId) query = query.eq("id", orderId);

  const { data: orders, error } = await query;
  if (error) throw error;

  // For SalesInvoices, fetch by InvoiceID (GUID) 
  for (const order of orders) {
    try {
      const invoiceId = order.exact_invoice_id;
      const url = `${baseUrl}/api/v1/${exactDivision}/salesinvoice/SalesInvoices(guid'${invoiceId}')?$select=InvoiceID,AmountDC,AmountDiscount,Status`;
      const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } });

      if (!response.ok) {
        await response.text();
        results.skipped++;
        continue;
      }

      const data = await response.json();
      const invoice = data.d;
      if (!invoice) { results.skipped++; continue; }

      // Status: 20=Open, 50=Processed — use receivables for actual payment
      const amountDC = invoice.AmountDC || 0;
      const totalIncl = order.total_incl_vat || 0;
      const amountPaid = Math.max(0, totalIncl - amountDC);
      let paymentStatus: "open" | "deels_betaald" | "betaald" = "open";
      if (amountDC <= 0.01) paymentStatus = "betaald";
      else if (amountPaid > 0.01) paymentStatus = "deels_betaald";

      if (paymentStatus !== order.payment_status || Math.abs(amountPaid - (order.amount_paid || 0)) > 0.01) {
        await supabase.from("orders").update({ payment_status: paymentStatus, amount_paid: amountPaid }).eq("id", order.id);
        results.updated++;
      } else {
        results.skipped++;
      }
    } catch (err) {
      results.errors.push(`Order #${order.order_number}: ${String(err)}`);
    }
  }

  return results;
}

function mapVatRateToCode(vatRate: number): string {
  if (vatRate === 0) return "1";
  if (vatRate === 9) return "4";
  return "2";
}

async function getDefaultRevenueGLAccount(accessToken: string, baseUrl: string, exactDivision: number): Promise<string | null> {
  try {
    const url = `${baseUrl}/api/v1/${exactDivision}/financial/GLAccounts?$filter=Type eq 110&$select=ID,Code,Description&$orderby=Code`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } });
    if (!response.ok) return null;
    const data = await response.json();
    const accounts = data.d?.results || [];
    if (accounts.length === 0) return null;
    // deno-lint-ignore no-explicit-any
    const preferred = accounts.find((acc: any) => acc.Code?.startsWith("80") || acc.Description?.toLowerCase().includes("omzet"));
    return (preferred || accounts[0]).ID;
  } catch { return null; }
}

async function getSalesInvoiceJournal(accessToken: string, baseUrl: string, exactDivision: number): Promise<string> {
  try {
    // Type 70 = Sales invoice journal
    const url = `${baseUrl}/api/v1/${exactDivision}/financial/Journals?$filter=Type eq 70&$select=Code,Description,Type&$orderby=Code`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } });
    if (!response.ok) return "70";
    const data = await response.json();
    const journals = data.d?.results || [];
    if (journals.length === 0) return "70";
    // deno-lint-ignore no-explicit-any
    const preferred = journals.find((j: any) => j.Description?.toLowerCase().includes("verkoop"));
    return (preferred || journals[0]).Code;
  } catch { return "70"; }
}

function mapToExactSalesInvoice(
  order: AbitareOrder,
  accountId: string,
  glAccountId: string | null,
  journalCode: string,
  productItemMap: Map<string, string>
): ExactSalesInvoice {
  const lines: ExactSalesInvoiceLine[] = [];
  const orderLines = order.order_lines || [];

  for (const line of orderLines) {
    if (line.is_group_header) continue;

    const exactItemId = line.product_id ? productItemMap.get(line.product_id) : undefined;
    const invoiceLine: ExactSalesInvoiceLine = {
      Description: (line.description || "").substring(0, 100),
      Quantity: line.quantity || 1,
      NetPrice: line.unit_price || 0,
      VATCode: mapVatRateToCode(line.vat_rate || 21),
    };

    // Prefer Item (Exact article) over GLAccount
    if (exactItemId) {
      invoiceLine.Item = exactItemId;
    } else if (glAccountId) {
      invoiceLine.GLAccount = glAccountId;
    }

    lines.push(invoiceLine);
  }

  if (lines.length === 0) {
    const fallbackLine: ExactSalesInvoiceLine = {
      Description: `Order #${order.order_number}`,
      Quantity: 1,
      NetPrice: order.total_excl_vat || 0,
      VATCode: "2",
    };
    if (glAccountId) fallbackLine.GLAccount = glAccountId;
    lines.push(fallbackLine);
  }

  return {
    Journal: journalCode,
    OrderedBy: accountId,
    InvoiceDate: order.order_date || new Date().toISOString().split("T")[0],
    Description: `Factuur order #${order.order_number}`,
    YourRef: `ORD-${order.order_number}`,
    Currency: "EUR",
    SalesInvoiceLines: lines,
  };
}

// deno-lint-ignore no-explicit-any
async function ensureCustomerInExact(supabase: any, accessToken: string, baseUrl: string, exactDivision: number, customerId: string): Promise<string | null> {
  try {
    const { data: customer, error } = await supabase.from("customers").select("*").eq("id", customerId).single();
    if (error || !customer) return null;
    if (customer.exact_account_id) return customer.exact_account_id;

    const code = String(customer.customer_number);
    const searchUrl = `${baseUrl}/api/v1/${exactDivision}/crm/Accounts?$filter=Code eq '${code}'&$select=ID,Code,Name`;
    const searchRes = await fetch(searchUrl, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } });
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      const existing = (searchData.d?.results || [])[0];
      if (existing?.ID) {
        await supabase.from("customers").update({ exact_account_id: existing.ID }).eq("id", customerId);
        return existing.ID;
      }
    } else { await searchRes.text(); }

    const name = customer.company_name || [customer.first_name, customer.last_name].filter(Boolean).join(" ");
    const accountData: Record<string, unknown> = { Code: code, Name: name || `Klant ${customer.customer_number}`, Status: "C" };
    if (customer.email) accountData.Email = customer.email;
    if (customer.phone) accountData.Phone = customer.phone;
    if (customer.city) accountData.City = customer.city;
    if (customer.postal_code) accountData.Postcode = customer.postal_code;
    if (customer.street_address) accountData.AddressLine1 = customer.street_address;

    const createRes = await fetch(`${baseUrl}/api/v1/${exactDivision}/crm/Accounts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(accountData),
    });
    if (!createRes.ok) { console.error("Failed to create Exact account:", await createRes.text()); return null; }
    const createData = await createRes.json();
    const newId = createData.d?.ID;
    if (newId) await supabase.from("customers").update({ exact_account_id: newId }).eq("id", customerId);
    return newId || null;
  } catch (err) { console.error("Error ensuring customer in Exact:", err); return null; }
}
