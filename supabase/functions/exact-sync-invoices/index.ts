// exact-sync-invoices — Push/Pull facturen naar/van Exact Online
// Vakflow schema: invoices.items (JSON array), company_id, exact_id

import { jsonRes, optionsResponse } from "../_shared/cors.ts";
import { createAdminClient, authenticateRequest, AuthError } from "../_shared/supabase.ts";
import { getExactTokenFromConnection } from "../_shared/exact-connect.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);

  try {
    const { companyId } = await authenticateRequest(req);
    const admin = createAdminClient();
    const { action, divisionId, invoiceId } = await req.json();
    if (!divisionId) throw new Error("divisionId is required");

    const { data: connection, error: connError } = await admin
      .from("exact_online_connections").select("*")
      .eq("division_id", divisionId).eq("is_active", true).single();
    if (connError || !connection) throw new Error("Geen actieve Exact Online verbinding gevonden");

    const { access_token, base_url, division } = await getExactTokenFromConnection(connection);

    // Get GL account and journal
    const glAccountId = await getDefaultRevenueGLAccount(access_token, base_url, division);
    const journalCode = await getSalesInvoiceJournal(access_token, base_url, division);

    if (action === "push") {
      const result = await pushInvoices(admin, access_token, base_url, division, companyId, glAccountId, journalCode, invoiceId);
      return jsonRes(result, 200, req);
    } else if (action === "pull_status") {
      const result = await pullPaymentStatus(admin, access_token, base_url, division, companyId);
      return jsonRes(result, 200, req);
    } else if (action === "sync") {
      const pushed = await pushInvoices(admin, access_token, base_url, division, companyId, glAccountId, journalCode, invoiceId);
      const pulled = await pullPaymentStatus(admin, access_token, base_url, division, companyId);
      return jsonRes({ success: true, pushed, pulled }, 200, req);
    }
    throw new Error("Invalid action. Use 'push', 'pull_status', or 'sync'");
  } catch (err: any) {
    if (err instanceof AuthError) return jsonRes({ error: err.message }, err.status, req);
    console.error("exact-sync-invoices error:", err);
    return jsonRes({ error: err.message }, 500, req);
  }
});

// deno-lint-ignore no-explicit-any
async function pushInvoices(supabase: any, accessToken: string, baseUrl: string, exactDivision: number, companyId: string, glAccountId: string | null, journalCode: string, invoiceId?: string) {
  let query = supabase.from("invoices").select("*, customers(name, exact_account_id)").eq("company_id", companyId);
  if (invoiceId) query = query.eq("id", invoiceId);
  else query = query.is("exact_id", null).neq("status", "concept");

  const { data: invoices, error } = await query;
  if (error) throw error;

  const results = { success: true, created: 0, skipped: 0, failed: 0, errors: [] as string[] };

  for (const invoice of (invoices || [])) {
    try {
      if (invoice.exact_id && !invoiceId) { results.skipped++; continue; }

      let accountId = invoice.customers?.exact_account_id;
      if (!accountId) {
        // Auto-push customer first
        accountId = await ensureCustomerInExact(supabase, accessToken, baseUrl, exactDivision, invoice.customer_id);
        if (!accountId) { results.skipped++; results.errors.push(`Factuur ${invoice.invoice_number}: Klant kon niet naar Exact`); continue; }
      }

      // Build invoice lines from JSON items
      const items = (invoice.items as any[]) || [];
      // deno-lint-ignore no-explicit-any
      const lines: any[] = items.map((item: any) => {
        // deno-lint-ignore no-explicit-any
        const line: any = {
          Description: (item.description || item.omschrijving || "").substring(0, 100),
          Quantity: item.quantity || item.aantal || 1,
          NetPrice: item.unit_price || item.prijs || 0,
          VATCode: mapVatCode(item.vat_percentage ?? item.btw_percentage ?? 21),
          Item: item.exact_item_id || undefined,
        };
        if (glAccountId) line.GLAccount = glAccountId;
        return line;
      });

      if (lines.length === 0) {
        lines.push({
          Description: `Factuur ${invoice.invoice_number}`,
          Quantity: 1,
          NetPrice: invoice.subtotal || 0,
          VATCode: "2",
          ...(glAccountId ? { GLAccount: glAccountId } : {}),
        });
      }

      const exactInvoice = {
        Journal: journalCode,
        OrderedBy: accountId,
        InvoiceDate: invoice.issued_at || new Date().toISOString().split("T")[0],
        Description: `Factuur ${invoice.invoice_number}`,
        YourRef: invoice.invoice_number || "",
        Currency: "EUR",
        SalesInvoiceLines: lines,
      };

      const res = await fetch(`${baseUrl}/api/v1/${exactDivision}/salesinvoice/SalesInvoices`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(exactInvoice),
      });

      if (!res.ok) {
        results.failed++;
        results.errors.push(`${invoice.invoice_number}: ${await res.text()}`);
      } else {
        const data = await res.json();
        const exactId = data.d?.InvoiceID;
        if (exactId) await supabase.from("invoices").update({ exact_id: exactId }).eq("id", invoice.id);
        results.created++;
      }
    } catch (err) {
      results.failed++;
      results.errors.push(`${invoice.invoice_number}: ${String(err)}`);
    }
  }
  return results;
}

// deno-lint-ignore no-explicit-any
async function pullPaymentStatus(supabase: any, accessToken: string, baseUrl: string, exactDivision: number, companyId: string) {
  const results = { success: true, updated: 0, skipped: 0, errors: [] as string[] };

  const { data: invoices, error } = await supabase.from("invoices")
    .select("id, invoice_number, exact_id, status, total")
    .eq("company_id", companyId).not("exact_id", "is", null);
  if (error) throw error;

  for (const invoice of (invoices || [])) {
    try {
      const url = `${baseUrl}/api/v1/${exactDivision}/salesinvoice/SalesInvoices(guid'${invoice.exact_id}')?$select=InvoiceID,AmountDC,Status`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } });
      if (!res.ok) { results.skipped++; continue; }

      const data = await res.json();
      const amountDC = data.d?.AmountDC || 0;

      // AmountDC = remaining amount. If <= 0.01, fully paid
      let newStatus = invoice.status;
      if (amountDC <= 0.01 && invoice.status !== "betaald") {
        newStatus = "betaald";
      }

      if (newStatus !== invoice.status) {
        await supabase.from("invoices").update({ status: newStatus, paid_at: new Date().toISOString() }).eq("id", invoice.id);
        results.updated++;
      } else {
        results.skipped++;
      }
    } catch (err) {
      results.errors.push(`${invoice.invoice_number}: ${String(err)}`);
    }
  }
  return results;
}

function mapVatCode(vatPct: number): string {
  if (vatPct === 0) return "1";
  if (vatPct === 9) return "4";
  return "2"; // 21%
}

async function getDefaultRevenueGLAccount(accessToken: string, baseUrl: string, division: number): Promise<string | null> {
  try {
    const url = `${baseUrl}/api/v1/${division}/financial/GLAccounts?$filter=Type eq 110&$select=ID,Code,Description&$orderby=Code&$top=20`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } });
    if (!res.ok) return null;
    const data = await res.json();
    const accounts = data.d?.results || [];
    if (accounts.length === 0) return null;
    // deno-lint-ignore no-explicit-any
    const preferred = accounts.find((a: any) => a.Code?.startsWith("80") || a.Description?.toLowerCase().includes("omzet"));
    return (preferred || accounts[0]).ID;
  } catch { return null; }
}

async function getSalesInvoiceJournal(accessToken: string, baseUrl: string, division: number): Promise<string> {
  try {
    const url = `${baseUrl}/api/v1/${division}/financial/Journals?$filter=Type eq 70&$select=Code,Description&$top=5`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } });
    if (!res.ok) return "70";
    const data = await res.json();
    const journals = data.d?.results || [];
    if (journals.length === 0) return "70";
    // deno-lint-ignore no-explicit-any
    const preferred = journals.find((j: any) => j.Description?.toLowerCase().includes("verkoop"));
    return (preferred || journals[0]).Code;
  } catch { return "70"; }
}

// deno-lint-ignore no-explicit-any
async function ensureCustomerInExact(supabase: any, accessToken: string, baseUrl: string, exactDivision: number, customerId: string): Promise<string | null> {
  try {
    const { data: customer, error } = await supabase.from("customers").select("*").eq("id", customerId).single();
    if (error || !customer) return null;
    if (customer.exact_account_id) return customer.exact_account_id;

    const accountData: Record<string, unknown> = {
      Name: customer.name || "Onbekend",
      Status: "C",
    };
    if (customer.email) accountData.Email = customer.email;
    if (customer.phone) accountData.Phone = customer.phone;
    if (customer.city) accountData.City = customer.city;
    if (customer.postal_code) accountData.Postcode = customer.postal_code;
    if (customer.address) accountData.AddressLine1 = customer.address;

    const res = await fetch(`${baseUrl}/api/v1/${exactDivision}/crm/Accounts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(accountData),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const newId = data.d?.ID;
    if (newId) await supabase.from("customers").update({ exact_account_id: newId }).eq("id", customerId);
    return newId || null;
  } catch { return null; }
}
