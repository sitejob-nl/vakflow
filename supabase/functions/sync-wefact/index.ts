import { corsHeaders, jsonRes, optionsResponse } from "../_shared/cors.ts";
import { createAdminClient, authenticateRequest, AuthError } from "../_shared/supabase.ts";
import { logEdgeFunctionError } from "../_shared/error-logger.ts";
import { decrypt } from "../_shared/crypto.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";

const WEFACT_API_URL = "https://api.mijnwefact.nl/v2/";

/**
 * WeFact API uses POST with application/x-www-form-urlencoded.
 * Nested objects/arrays are flattened: InvoiceLines[0][Description] = "..."
 */
function flattenParams(
  params: Record<string, any>,
  prefix = "",
  body: URLSearchParams = new URLSearchParams()
): URLSearchParams {
  for (const [key, value] of Object.entries(params)) {
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (typeof item === "object" && item !== null) {
          flattenParams(item, `${fullKey}[${i}]`, body);
        } else {
          body.append(`${fullKey}[${i}]`, String(item));
        }
      });
    } else if (typeof value === "object") {
      flattenParams(value, fullKey, body);
    } else {
      body.append(fullKey, String(value));
    }
  }
  return body;
}

async function wefactRequest(apiKey: string, controller: string, action: string, params: Record<string, any> = {}) {
  const body = new URLSearchParams();
  body.append("api_key", apiKey);
  body.append("controller", controller);
  body.append("action", action);
  flattenParams(params, "", body);

  const res = await fetch(WEFACT_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = await res.json();
  if (data.status === "error") {
    const errorMsg = Array.isArray(data.errors) ? data.errors.join(", ") : (data.errors || "WeFact API fout");
    throw new Error(errorMsg);
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonRes({ error: "Method not allowed" }, 405);

  try {
    const { userId, companyId } = await authenticateRequest(req);
    const supabaseAdmin = createAdminClient();

    await checkRateLimit(supabaseAdmin, companyId, "sync_wefact", 5);

    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("id, wefact_api_key")
      .eq("id", companyId)
      .single();

    const reqBody = await req.json();
    const { action } = reqBody;

    // For test action with token in body (before saving)
    let apiKey: string | null = null;

    if (action === "test" && reqBody.token) {
      apiKey = reqBody.token;
    } else {
      if (!company?.wefact_api_key) {
        return jsonRes({ error: "WeFact is niet gekoppeld — vul je API key in bij Instellingen > Koppelingen" }, 400);
      }
      try {
        apiKey = company.wefact_api_key.includes(":")
          ? await decrypt(company.wefact_api_key)
          : company.wefact_api_key;
      } catch {
        apiKey = company.wefact_api_key;
      }
    }

    if (!apiKey) {
      return jsonRes({ error: "Geen WeFact API key beschikbaar" }, 400);
    }

    // === TEST ===
    if (action === "test") {
      await wefactRequest(apiKey, "debtor", "list", { limit: 1 });
      return jsonRes({ success: true });
    }

    // === SYNC CONTACTS (push to WeFact) ===
    if (action === "sync-contacts") {
      const { data: customers } = await supabaseAdmin
        .from("customers")
        .select("*")
        .eq("company_id", companyId)
        .is("wefact_debtor_code", null);

      let synced = 0;
      const errors: string[] = [];

      for (const cust of customers || []) {
        try {
          const isCompany = cust.type === "zakelijk";
          const params: any = {};
          if (isCompany) {
            params.CompanyName = cust.name;
            if (cust.contact_person) params.SurName = cust.contact_person;
          } else {
            params.SurName = cust.name;
          }
          if (cust.email) params.EmailAddress = cust.email;
          if (cust.phone) params.PhoneNumber = cust.phone;
          if (cust.address) params.Address = cust.address;
          if (cust.postal_code) params.ZipCode = cust.postal_code;
          if (cust.city) params.City = cust.city;
          params.Country = "NL";

          const result = await wefactRequest(apiKey, "debtor", "add", params);
          const debtorCode = result?.debtor?.DebtorCode || result?.DebtorCode;
          if (debtorCode) {
            await supabaseAdmin.from("customers").update({ wefact_debtor_code: debtorCode }).eq("id", cust.id);
            synced++;
          }
        } catch (err: any) {
          errors.push(`${cust.name}: ${err.message}`);
        }
      }

      return jsonRes({ synced, skipped: 0, errors });
    }

    // === PULL CONTACTS (from WeFact) ===
    if (action === "pull-contacts") {
      let offset = 0;
      let allDebtors: any[] = [];
      while (true) {
        const result = await wefactRequest(apiKey, "debtor", "list", { limit: 100, offset });
        const debtors = result?.debtors || [];
        if (!Array.isArray(debtors) || debtors.length === 0) break;
        allDebtors = allDebtors.concat(debtors);
        if (debtors.length < 100) break;
        offset += 100;
      }

      let created = 0, updated = 0;
      const errors: string[] = [];

      for (const debtor of allDebtors) {
        try {
          const debtorCode = debtor.DebtorCode;
          if (!debtorCode) continue;

          const name = debtor.CompanyName || `${debtor.Initials || ""} ${debtor.SurName || ""}`.trim() || `Debiteur ${debtorCode}`;
          const customerData: any = {
            name,
            contact_person: debtor.SurName && debtor.CompanyName ? `${debtor.Initials || ""} ${debtor.SurName}`.trim() : null,
            email: debtor.EmailAddress || null,
            phone: debtor.PhoneNumber || null,
            address: debtor.Address || null,
            postal_code: debtor.ZipCode || null,
            city: debtor.City || null,
            wefact_debtor_code: debtorCode,
            type: debtor.CompanyName ? "zakelijk" : "particulier",
          };

          const { data: existing } = await supabaseAdmin
            .from("customers")
            .select("id")
            .eq("wefact_debtor_code", debtorCode)
            .eq("company_id", companyId)
            .maybeSingle();

          if (existing) {
            await supabaseAdmin.from("customers").update(customerData).eq("id", existing.id);
            updated++;
          } else {
            customerData.company_id = companyId;
            await supabaseAdmin.from("customers").insert(customerData);
            created++;
          }
        } catch (err: any) {
          errors.push(`Debiteur ${debtor.DebtorCode}: ${err.message}`);
        }
      }

      return jsonRes({ total: allDebtors.length, created, updated, errors });
    }

    // === CREATE INVOICE (push single) ===
    if (action === "create-invoice") {
      const { invoice_id } = reqBody;
      if (!invoice_id) return jsonRes({ error: "invoice_id is verplicht" }, 400);

      const { data: inv } = await supabaseAdmin
        .from("invoices")
        .select("*, customers(id, name, wefact_debtor_code)")
        .eq("id", invoice_id)
        .single();

      if (!inv) return jsonRes({ error: "Factuur niet gevonden" }, 404);

      const customer = inv.customers as any;

      // Auto-sync customer if no debtor code yet
      let debtorCode = customer?.wefact_debtor_code;
      if (!debtorCode && customer) {
        const params: any = {};
        const isCompany = customer.type === "zakelijk";
        if (isCompany) {
          params.CompanyName = customer.name;
        } else {
          params.SurName = customer.name;
        }
        params.Country = "NL";

        const custResult = await wefactRequest(apiKey, "debtor", "add", params);
        debtorCode = custResult?.debtor?.DebtorCode || custResult?.DebtorCode;
        if (debtorCode) {
          await supabaseAdmin.from("customers").update({ wefact_debtor_code: debtorCode }).eq("id", customer.id);
        }
      }

      if (!debtorCode) return jsonRes({ error: "Kon debiteur niet aanmaken in WeFact" }, 400);

      const vatPct = Number(inv.vat_percentage || 21);
      const items = Array.isArray(inv.items) ? inv.items : [];
      const invoiceLines = items.map((item: any) => ({
        Description: item.description || "Item",
        Number: String(item.qty || 1),
        PriceExcl: Number((Number(item.unit_price || 0) / (1 + vatPct / 100)).toFixed(4)),
        TaxCode: vatPct === 21 ? "V21" : vatPct === 9 ? "V9" : "V0",
      }));

      const result = await wefactRequest(apiKey, "invoice", "add", {
        DebtorCode: debtorCode,
        InvoiceLines: invoiceLines,
      });

      const wefactId = result?.invoice?.Identifier;
      const invoiceCode = result?.invoice?.InvoiceCode;

      if (wefactId) {
        await supabaseAdmin.from("invoices").update({
          wefact_id: wefactId,
          invoice_number: invoiceCode || inv.invoice_number,
        }).eq("id", inv.id);
      }

      return jsonRes({ success: true, wefact_id: wefactId, invoice_number: invoiceCode });
    }

    // === SYNC INVOICES (bulk push) ===
    if (action === "sync-invoices") {
      const { data: invoices } = await supabaseAdmin
        .from("invoices")
        .select("*, customers(id, name, wefact_debtor_code)")
        .eq("company_id", companyId)
        .is("wefact_id", null);

      let synced = 0, skipped = 0;
      const errors: string[] = [];

      for (const inv of invoices || []) {
        try {
          const customer = inv.customers as any;
          if (!customer?.wefact_debtor_code) { skipped++; continue; }

          const vatPct = Number(inv.vat_percentage || 21);
          const items = Array.isArray(inv.items) ? inv.items : [];
          const invoiceLines = items.map((item: any) => ({
            Description: item.description || "Item",
            Number: String(item.qty || 1),
            PriceExcl: Number((Number(item.unit_price || 0) / (1 + vatPct / 100)).toFixed(4)),
            TaxCode: vatPct === 21 ? "V21" : vatPct === 9 ? "V9" : "V0",
          }));

          const result = await wefactRequest(apiKey, "invoice", "add", {
            DebtorCode: customer.wefact_debtor_code,
            InvoiceLines: invoiceLines,
          });

          const wefactId = result?.invoice?.Identifier;
          if (wefactId) {
            await supabaseAdmin.from("invoices").update({ wefact_id: wefactId }).eq("id", inv.id);
            synced++;
          }
        } catch (err: any) {
          errors.push(`${inv.invoice_number || inv.id}: ${err.message}`);
        }
      }

      return jsonRes({ synced, skipped, errors });
    }

    // === PULL INVOICES (from WeFact) ===
    if (action === "pull-invoices") {
      let offset = 0;
      let allInvoices: any[] = [];
      while (true) {
        const result = await wefactRequest(apiKey, "invoice", "list", { limit: 100, offset });
        const invoices = result?.invoices || [];
        if (!Array.isArray(invoices) || invoices.length === 0) break;
        allInvoices = allInvoices.concat(invoices);
        if (invoices.length < 100) break;
        offset += 100;
      }

      const { data: existingInvoices } = await supabaseAdmin
        .from("invoices")
        .select("id, wefact_id")
        .eq("company_id", companyId)
        .not("wefact_id", "is", null);

      const existingSet = new Set((existingInvoices || []).map(e => e.wefact_id));

      let imported = 0, skippedNoCustomer = 0;
      const errors: string[] = [];

      for (const wInv of allInvoices) {
        try {
          const wefactId = wInv.Identifier;
          if (existingSet.has(wefactId)) continue;

          // Find customer by debtor code
          const debtorCode = wInv.DebtorCode;
          const { data: customer } = await supabaseAdmin
            .from("customers")
            .select("id")
            .eq("wefact_debtor_code", debtorCode)
            .eq("company_id", companyId)
            .maybeSingle();

          if (!customer) { skippedNoCustomer++; continue; }

          // Map WeFact status
          const statusMap: Record<string, string> = {
            "0": "concept", "2": "verzonden", "3": "verzonden",
            "4": "betaald", "8": "gecrediteerd", "9": "verlopen",
          };
          const status = statusMap[String(wInv.Status)] || "concept";

          const subtotal = Number(wInv.AmountExcl || 0);
          const total = Number(wInv.AmountIncl || 0);

          await supabaseAdmin.from("invoices").insert({
            customer_id: customer.id,
            company_id: companyId,
            wefact_id: wefactId,
            invoice_number: wInv.InvoiceCode || null,
            subtotal,
            total,
            vat_amount: total - subtotal,
            items: [],
            status,
            issued_at: wInv.Date || null,
            paid_at: status === "betaald" ? (wInv.PayDate || new Date().toISOString().split("T")[0]) : null,
          });
          imported++;
        } catch (err: any) {
          errors.push(`Invoice ${wInv.InvoiceCode}: ${err.message}`);
        }
      }

      return jsonRes({
        total_in_wefact: allInvoices.length,
        already_imported: existingSet.size,
        imported,
        skipped_no_customer: skippedNoCustomer,
        errors,
      });
    }

    // === PULL INVOICE STATUS ===
    if (action === "pull-invoice-status") {
      const { data: unpaid } = await supabaseAdmin
        .from("invoices")
        .select("id, wefact_id")
        .eq("company_id", companyId)
        .not("wefact_id", "is", null)
        .neq("status", "betaald");

      let checked = 0, updated = 0;
      const errors: string[] = [];

      for (const inv of unpaid || []) {
        try {
          const result = await wefactRequest(apiKey, "invoice", "show", { Identifier: inv.wefact_id });
          const wInv = result?.invoice;
          checked++;
          if (wInv && String(wInv.Status) === "4") {
            await supabaseAdmin
              .from("invoices")
              .update({ status: "betaald", paid_at: wInv.PayDate || new Date().toISOString().split("T")[0] })
              .eq("id", inv.id);
            updated++;
          }
        } catch (err: any) {
          errors.push(`Invoice ${inv.wefact_id}: ${err.message}`);
        }
      }

      return jsonRes({ checked, updated, errors });
    }

    // === SYNC QUOTES (push) ===
    if (action === "sync-quotes") {
      const { data: quotes } = await supabaseAdmin
        .from("quotes")
        .select("*, customers(id, name, wefact_debtor_code)")
        .eq("company_id", companyId)
        .is("wefact_id", null);

      let synced = 0, skipped = 0;
      const errors: string[] = [];

      for (const quote of quotes || []) {
        try {
          const customer = quote.customers as any;
          if (!customer?.wefact_debtor_code) { skipped++; continue; }

          const vatPct = Number(quote.vat_percentage || 21);
          const items = Array.isArray(quote.items) ? quote.items : [];
          const lines = items.map((item: any) => ({
            Description: item.description || "Item",
            Number: String(item.qty || 1),
            PriceExcl: Number((Number(item.unit_price || 0) / (1 + vatPct / 100)).toFixed(4)),
            TaxCode: vatPct === 21 ? "V21" : vatPct === 9 ? "V9" : "V0",
          }));

          const result = await wefactRequest(apiKey, "pricequote", "add", {
            DebtorCode: customer.wefact_debtor_code,
            PriceQuoteLines: lines,
          });

          const wefactId = result?.pricequote?.Identifier;
          if (wefactId) {
            await supabaseAdmin.from("quotes").update({ wefact_id: wefactId }).eq("id", quote.id);
            synced++;
          }
        } catch (err: any) {
          errors.push(`${quote.quote_number || quote.id}: ${err.message}`);
        }
      }

      return jsonRes({ synced, skipped, errors });
    }

    // === CREATE QUOTE (push single) ===
    if (action === "create-quote") {
      const { quote_id } = reqBody;
      if (!quote_id) return jsonRes({ error: "quote_id is verplicht" }, 400);

      const { data: quote } = await supabaseAdmin
        .from("quotes")
        .select("*, customers(id, name, wefact_debtor_code, type)")
        .eq("id", quote_id)
        .single();

      if (!quote) return jsonRes({ error: "Offerte niet gevonden" }, 404);

      const customer = quote.customers as any;
      let debtorCode = customer?.wefact_debtor_code;

      if (!debtorCode && customer) {
        const params: any = {};
        if (customer.type === "zakelijk") {
          params.CompanyName = customer.name;
        } else {
          params.SurName = customer.name;
        }
        params.Country = "NL";
        const custResult = await wefactRequest(apiKey, "debtor", "add", params);
        debtorCode = custResult?.debtor?.DebtorCode || custResult?.DebtorCode;
        if (debtorCode) {
          await supabaseAdmin.from("customers").update({ wefact_debtor_code: debtorCode }).eq("id", customer.id);
        }
      }

      if (!debtorCode) return jsonRes({ error: "Kon debiteur niet aanmaken in WeFact" }, 400);

      const vatPct = Number(quote.vat_percentage || 21);
      const items = Array.isArray(quote.items) ? quote.items : [];
      const lines = items.map((item: any) => ({
        Description: item.description || "Item",
        Number: String(item.qty || 1),
        PriceExcl: Number((Number(item.unit_price || 0) / (1 + vatPct / 100)).toFixed(4)),
        TaxCode: vatPct === 21 ? "V21" : vatPct === 9 ? "V9" : "V0",
      }));

      const result = await wefactRequest(apiKey, "pricequote", "add", {
        DebtorCode: debtorCode,
        PriceQuoteLines: lines,
      });

      const wefactId = result?.pricequote?.Identifier;
      const quoteCode = result?.pricequote?.PriceQuoteCode;

      if (wefactId) {
        await supabaseAdmin.from("quotes").update({
          wefact_id: wefactId,
          quote_number: quoteCode || quote.quote_number,
        }).eq("id", quote.id);
      }

      return jsonRes({ success: true, wefact_id: wefactId, quote_number: quoteCode });
    }

    // === PULL QUOTES ===
    if (action === "pull-quotes") {
      let offset = 0;
      let allQuotes: any[] = [];
      while (true) {
        const result = await wefactRequest(apiKey, "pricequote", "list", { limit: 100, offset });
        const quotes = result?.pricequotes || [];
        if (!Array.isArray(quotes) || quotes.length === 0) break;
        allQuotes = allQuotes.concat(quotes);
        if (quotes.length < 100) break;
        offset += 100;
      }

      const { data: existingQuotes } = await supabaseAdmin
        .from("quotes")
        .select("id, wefact_id")
        .eq("company_id", companyId)
        .not("wefact_id", "is", null);

      const existingSet = new Set((existingQuotes || []).map(e => e.wefact_id));

      let imported = 0, skippedNoCustomer = 0;
      const errors: string[] = [];

      for (const wQ of allQuotes) {
        try {
          const wefactId = wQ.Identifier;
          if (existingSet.has(wefactId)) continue;

          const debtorCode = wQ.DebtorCode;
          const { data: customer } = await supabaseAdmin
            .from("customers")
            .select("id")
            .eq("wefact_debtor_code", debtorCode)
            .eq("company_id", companyId)
            .maybeSingle();

          if (!customer) { skippedNoCustomer++; continue; }

          const subtotal = Number(wQ.AmountExcl || 0);
          const total = Number(wQ.AmountIncl || 0);

          // Need a user_id for quotes table
          const { data: adminUser } = await supabaseAdmin
            .from("user_roles")
            .select("user_id")
            .eq("company_id", companyId)
            .eq("role", "admin")
            .limit(1)
            .single();

          await supabaseAdmin.from("quotes").insert({
            customer_id: customer.id,
            company_id: companyId,
            user_id: adminUser?.user_id || userId,
            wefact_id: wefactId,
            quote_number: wQ.PriceQuoteCode || null,
            subtotal,
            total,
            vat_amount: total - subtotal,
            items: [],
            status: "concept",
          });
          imported++;
        } catch (err: any) {
          errors.push(`Quote ${wQ.PriceQuoteCode}: ${err.message}`);
        }
      }

      return jsonRes({
        total_in_wefact: allQuotes.length,
        already_imported: existingSet.size,
        imported,
        skipped_no_customer: skippedNoCustomer,
        errors,
      });
    }

    return jsonRes({ error: `Onbekende actie: ${action}` }, 400);

  } catch (error: any) {
    if (error instanceof AuthError) {
      return jsonRes({ error: error.message }, error.status);
    }
    if (error instanceof RateLimitError) {
      return jsonRes({ error: error.message }, 429);
    }
    console.error("sync-wefact error:", error);
    try {
      const supabaseAdmin = createAdminClient();
      await logEdgeFunctionError(supabaseAdmin, "sync-wefact", error.message, { stack: error.stack });
    } catch {}
    return jsonRes({ error: error.message || "Interne fout" }, 500);
  }
});
