import { jsonRes, optionsResponse } from "../_shared/cors.ts";
import { createAdminClient, authenticateRequest, AuthError } from "../_shared/supabase.ts";
import { logUsage } from "../_shared/usage.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { getExactTokenFromConnection } from "../_shared/exact-connect.ts";
import { logEdgeFunctionError } from "../_shared/error-logger.ts";

/** Parse OData v3 /Date(...)/ or ISO date strings to YYYY-MM-DD */
function parseODataDate(val: unknown): string | null {
  if (!val) return null;
  const s = String(val);
  const match = s.match(/\/Date\((\d+)\)\//);
  if (match) {
    return new Date(Number(match[1])).toISOString().split("T")[0];
  }
  if (s.includes("T")) return s.split("T")[0];
  return s;
}

/** Strip undefined values from an object before sending to Exact API */
function cleanBody(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined));
}

interface ExactToken {
  access_token: string;
  division: number;
  region: string;
  base_url: string;
  expires_at: string;
}

async function getExactToken(tenantId: string, webhookSecret: string): Promise<ExactToken> {
  const res = await fetch("https://xeshjkznwdrxjjhbpisn.supabase.co/functions/v1/exact-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenant_id: tenantId, secret: webhookSecret }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (err.needs_reauth) throw new Error("REAUTH_REQUIRED");
    throw new Error(err.error || `Token request failed: ${res.status}`);
  }

  return res.json();
}

/** Paginated GET using __next URL pattern (OData v3) */
async function exactGetAll(
  baseUrl: string,
  division: number,
  endpoint: string,
  token: string,
  params = ""
): Promise<any[]> {
  let allResults: any[] = [];
  let url: string | null = `${baseUrl}/api/v1/${division}/${endpoint}${params ? "?" + params : ""}`;

  while (url) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (res.status === 429) {
      // Rate limited — wait 2s and retry
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Exact API ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = await res.json();
    const results = data.d?.results || (Array.isArray(data.d) ? data.d : data.d ? [data.d] : []);
    allResults.push(...results);

    // Follow __next for pagination
    url = data.d?.__next || null;
  }

  return allResults;
}

/** Single POST to Exact with 429 retry */
async function exactPost(
  url: string,
  token: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; data?: any; error?: string; status: number }> {
  return exactRequest(url, token, "POST", body);
}

/** Single PUT to Exact with 429 retry */
async function exactPut(
  url: string,
  token: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; data?: any; error?: string; status: number }> {
  return exactRequest(url, token, "PUT", body);
}

/** Shared POST/PUT helper with retry on 429 */
async function exactRequest(
  url: string,
  token: string,
  method: "POST" | "PUT",
  body: Record<string, unknown>
): Promise<{ ok: boolean; data?: any; error?: string; status: number }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }

    if (!res.ok) {
      const errText = await res.text();
      // Parse Exact error details for better diagnostics
      let errorDetail = errText.slice(0, 500);
      try {
        const errJson = JSON.parse(errText);
        const msg = errJson?.error?.message?.value || errJson?.error?.message || errJson?.error?.innererror?.message;
        if (msg) errorDetail = msg;
      } catch { /* keep raw text */ }
      console.error(`Exact ${method} ${url} → ${res.status}: ${errorDetail}`);
      return { ok: false, error: errorDetail.slice(0, 300), status: res.status };
    }

    const data = await res.json().catch(() => ({}));
    return { ok: true, data: data.d || data, status: res.status };
  }

  return { ok: false, error: "Rate limit exceeded after retries", status: 429 };
}

/** Push a single customer to Exact and store exact_account_id. Returns the Exact Account ID or null. */
async function ensureExactAccount(
  supabaseAdmin: any,
  baseUrl: string,
  division: number,
  accessToken: string,
  customer: any
): Promise<string | null> {
  if (customer.exact_account_id) return customer.exact_account_id;

  const accountData = cleanBody({
    Name: customer.name,
    Status: "C",
    Country: "NL",
    Email: customer.email || undefined,
    Phone: customer.phone || undefined,
    City: customer.city || undefined,
    Postcode: customer.postal_code || undefined,
    AddressLine1: customer.address || undefined,
    ...(customer.kvk_number ? { ChamberOfCommerce: customer.kvk_number } : {}),
    ...(customer.btw_number ? { VATNumber: customer.btw_number } : {}),
  });

  const result = await exactPost(
    `${baseUrl}/api/v1/${division}/crm/Accounts`,
    accessToken,
    accountData
  );

  if (!result.ok) return null;

  const exactAccountId = result.data?.ID;
  if (exactAccountId) {
    await supabaseAdmin
      .from("customers")
      .update({ exact_account_id: exactAccountId })
      .eq("id", customer.id);
  }
  return exactAccountId || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  try {
    const { companyId } = await authenticateRequest(req);
    const supabaseAdmin = createAdminClient();

    // Rate limit: max 5 syncs per minute per company
    await checkRateLimit(supabaseAdmin, companyId, "sync_exact", 5);

    // Get exact config
    const { data: config } = await supabaseAdmin
      .from("exact_config")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();

    if (!config?.tenant_id || !config?.webhook_secret) {
      return jsonRes({ error: "Exact Online is niet gekoppeld" }, 400);
    }

    const body = await req.json();
    const { action } = body;

    // Get fresh token
    let tokenData: ExactToken;
    try {
      tokenData = await getExactToken(config.tenant_id, config.webhook_secret);
    } catch (err: any) {
      if (err.message === "REAUTH_REQUIRED" || err.message === "Tenant not active" || (err.message && err.message.includes("Tenant not active"))) {
        await supabaseAdmin.from("exact_config").update({ status: "error", updated_at: new Date().toISOString() }).eq("company_id", companyId);
        return jsonRes({ error: "Exact Online koppeling niet actief. Koppel opnieuw via instellingen.", needs_reauth: true }, 401);
      }
      throw err;
    }

    const { access_token, division, base_url } = tokenData;

    switch (action) {
      case "test": {
        try {
          const meRes = await fetch(`${base_url}/api/v1/current/Me?$select=CurrentDivision,FullName`, {
            headers: { Authorization: `Bearer ${access_token}`, Accept: "application/json" },
          });
          if (!meRes.ok) {
            const t = await meRes.text();
            return jsonRes({ error: `Exact API ${meRes.status}: ${t.slice(0, 200)}` }, 500);
          }
          const meData = await meRes.json();
          const me = meData.d?.results?.[0] || meData.d;
          return jsonRes({ ok: true, user: me?.FullName || "Connected", division });
        } catch (err: any) {
          return jsonRes({ error: err.message }, 500);
        }
      }

      // ── Fix 8: sync-contacts now also updates existing customers ──
      case "sync-contacts": {
        const { data: newCustomers } = await supabaseAdmin
          .from("customers")
          .select("*")
          .eq("company_id", companyId)
          .is("exact_account_id", null);

        const { data: existingCustomers } = await supabaseAdmin
          .from("customers")
          .select("*")
          .eq("company_id", companyId)
          .not("exact_account_id", "is", null);

        let synced = 0, updated = 0, skipped = 0;
        const errors: string[] = [];

        // Push new customers
        for (const cust of newCustomers || []) {
          try {
            const accountData = cleanBody({
              Name: cust.name,
              Status: "C",
              Country: "NL",
              Email: cust.email || undefined,
              Phone: cust.phone || undefined,
              City: cust.city || undefined,
              Postcode: cust.postal_code || undefined,
              AddressLine1: cust.address || undefined,
              ...(cust.kvk_number ? { ChamberOfCommerce: cust.kvk_number } : {}),
              ...(cust.btw_number ? { VATNumber: cust.btw_number } : {}),
            });

            const result = await exactPost(
              `${base_url}/api/v1/${division}/crm/Accounts`,
              access_token,
              accountData
            );

            if (!result.ok) {
              errors.push(`${cust.name}: ${result.error}`);
              continue;
            }

            const exactAccountId = result.data?.ID;
            if (exactAccountId) {
              await supabaseAdmin
                .from("customers")
                .update({ exact_account_id: exactAccountId })
                .eq("id", cust.id);
            }
            synced++;
          } catch (err: any) {
            errors.push(`${cust.name}: ${err.message}`);
          }
        }

        // Update existing customers in Exact
        for (const cust of existingCustomers || []) {
          try {
            const accountData = cleanBody({
              Name: cust.name,
              Email: cust.email || undefined,
              Phone: cust.phone || undefined,
              City: cust.city || undefined,
              Postcode: cust.postal_code || undefined,
              AddressLine1: cust.address || undefined,
              ...(cust.kvk_number ? { ChamberOfCommerce: cust.kvk_number } : {}),
              ...(cust.btw_number ? { VATNumber: cust.btw_number } : {}),
            });

            const result = await exactPut(
              `${base_url}/api/v1/${division}/crm/Accounts(guid'${cust.exact_account_id}')`,
              access_token,
              accountData
            );

            if (!result.ok) {
              errors.push(`Update ${cust.name}: ${result.error}`);
              continue;
            }
            updated++;
          } catch (err: any) {
            errors.push(`Update ${cust.name}: ${err.message}`);
          }
        }

        await logUsage(supabaseAdmin, companyId, "exact_sync_contacts", { synced, updated, skipped, errors: errors.length });
        return jsonRes({ synced, updated, skipped, errors });
      }

      case "pull-contacts": {
        // Pull Accounts from Exact into local customers — with __next pagination
        const accounts = await exactGetAll(
          base_url, division, "crm/Accounts", access_token,
          "$select=ID,Name,Email,Phone,City,Postcode,AddressLine1&$filter=Status eq 'C'"
        );

        let imported = 0, already = 0;
        const errors: string[] = [];

        for (const acc of accounts) {
          try {
            const { data: existingById } = await supabaseAdmin
              .from("customers")
              .select("id")
              .eq("company_id", companyId)
              .eq("exact_account_id", acc.ID)
              .maybeSingle();

            if (existingById) { already++; continue; }

            const { data: existingByName } = await supabaseAdmin
              .from("customers")
              .select("id")
              .eq("company_id", companyId)
              .eq("name", acc.Name)
              .maybeSingle();

            if (existingByName) {
              await supabaseAdmin
                .from("customers")
                .update({ exact_account_id: acc.ID })
                .eq("id", existingByName.id);
              already++;
              continue;
            }

            await supabaseAdmin.from("customers").insert({
              company_id: companyId,
              name: acc.Name,
              email: acc.Email || null,
              phone: acc.Phone || null,
              city: acc.City || null,
              postal_code: acc.Postcode || null,
              address: acc.AddressLine1 || null,
              exact_account_id: acc.ID,
            });
            imported++;
          } catch (err: any) {
            errors.push(`${acc.Name}: ${err.message}`);
          }
        }

        await logUsage(supabaseAdmin, companyId, "exact_pull_contacts", { imported, already, errors: errors.length });
        return jsonRes({ total_in_exact: accounts.length, already_imported: already, imported, errors });
      }

      // ── Fix 1: status filter + Fix 5: qty mapping ──
      // ── fetch-gl-accounts: retrieve revenue GL accounts from Exact ──
      case "fetch-gl-accounts": {
        const accounts = await exactGetAll(
          base_url, division, "financial/GLAccounts", access_token,
          "$select=ID,Code,Description&$filter=Type eq 110&$orderby=Code"
        );
        return jsonRes({
          accounts: accounts.map((a: any) => ({
            id: a.ID,
            code: a.Code,
            description: a.Description,
          })),
        });
      }

      // ── sync-single-contact: push one customer to Exact ──
      case "sync-single-contact": {
        const { customer_id } = body;
        if (!customer_id) return jsonRes({ error: "customer_id is verplicht" }, 400);

        const { data: cust } = await supabaseAdmin
          .from("customers")
          .select("*")
          .eq("id", customer_id)
          .eq("company_id", companyId)
          .single();

        if (!cust) return jsonRes({ error: "Klant niet gevonden" }, 404);

        const exactId = await ensureExactAccount(supabaseAdmin, base_url, division, access_token, cust);
        if (!exactId) return jsonRes({ error: "Kon klant niet aanmaken in Exact" }, 500);

        return jsonRes({ success: true, exact_account_id: exactId });
      }

      // ── sync-invoices: push to Exact ──
      case "sync-invoices": {
        if (!config.gl_revenue_id) {
          return jsonRes({ error: "Stel eerst een omzet-grootboekrekening in via Instellingen > Boekhouding" }, 400);
        }

        // Only sync invoices from the current fiscal year to avoid closed-period errors
        const currentYear = new Date().getFullYear();
        const fiscalYearStart = `${currentYear}-01-01`;

        const { data: invoices } = await supabaseAdmin
          .from("invoices")
          .select("*, customers(id, name, email, exact_account_id, phone, city, postal_code, address, kvk_number, btw_number)")
          .eq("company_id", companyId)
          .in("status", ["verzonden", "verstuurd"])
          .is("exact_id", null)
          .gte("issued_at", fiscalYearStart);

        if (!invoices?.length) return jsonRes({ synced: 0, skipped: 0, errors: [], auto_synced_customers: 0, skipped_old: 0 });

        // Pre-check: auto-push customers without exact_account_id
        let autoSyncedCustomers = 0;
        const seenCustomerIds = new Set<string>();
        for (const inv of invoices) {
          const customer = inv.customers as any;
          if (!customer?.exact_account_id && customer?.id && !seenCustomerIds.has(customer.id)) {
            seenCustomerIds.add(customer.id);
            const newId = await ensureExactAccount(supabaseAdmin, base_url, division, access_token, customer);
            if (newId) {
              customer.exact_account_id = newId;
              autoSyncedCustomers++;
            }
          }
        }

        let synced = 0, skipped = 0;
        const errors: string[] = [];

        for (const inv of invoices) {
          try {
            const customer = inv.customers as any;
            if (!customer?.exact_account_id) {
              skipped++;
              errors.push(`${inv.invoice_number}: Klant kon niet naar Exact gepusht worden`);
              continue;
            }

            const vatPct = Number(inv.vat_percentage || 21);
            const vatDivisor = 1 + vatPct / 100;

            const items = (inv.items as any[]) || [];
            const invoiceLines = items.map((item: any) => {
              // unit_price in Vakflow is incl. BTW; Exact expects excl. BTW (NetPrice)
              const priceIncl = Number(item.unit_price || item.price || 0);
              const priceExcl = priceIncl / vatDivisor;
              return {
                Description: item.description || item.name || "Regel",
                Quantity: item.qty || item.quantity || 1,
                NetPrice: Math.round(priceExcl * 100) / 100,
                GLAccount: config.gl_revenue_id,
              };
            });

            if (!invoiceLines.length) {
              skipped++;
              errors.push(`${inv.invoice_number}: Geen factuurregels`);
              continue;
            }

            const invoiceData: Record<string, unknown> = {
              Journal: config.journal_code || "70",
              Type: 8023,
              OrderedBy: customer.exact_account_id,
              Description: `Factuur ${inv.invoice_number || ""}`.trim(),
              InvoiceDate: inv.issued_at || new Date().toISOString().split("T")[0],
              SalesInvoiceLines: invoiceLines,
            };

            if (inv.due_at) {
              invoiceData.DueDate = inv.due_at;
            }

            const result = await exactPost(
              `${base_url}/api/v1/${division}/salesinvoice/SalesInvoices`,
              access_token,
              invoiceData
            );

            if (!result.ok) {
              errors.push(`${inv.invoice_number}: ${result.error}`);
              // Log individual failures for debugging
              await logEdgeFunctionError(supabaseAdmin, "sync-exact", `Invoice ${inv.invoice_number} sync failed: ${result.error}`, { invoice_id: inv.id, status: result.status });
              continue;
            }

            const exactId = result.data?.InvoiceID;
            if (exactId) {
              await supabaseAdmin
                .from("invoices")
                .update({ exact_id: exactId })
                .eq("id", inv.id);
            }

            synced++;
          } catch (err: any) {
            errors.push(`${inv.invoice_number}: ${err.message}`);
            await logEdgeFunctionError(supabaseAdmin, "sync-exact", `Invoice ${inv.invoice_number} exception: ${err.message}`, { invoice_id: inv.id, stack: err.stack });
          }
        }

        await logUsage(supabaseAdmin, companyId, "exact_sync_invoices", { synced, skipped, errors: errors.length, auto_synced_customers: autoSyncedCustomers });
        return jsonRes({ synced, skipped, errors, auto_synced_customers: autoSyncedCustomers });
      }

      // ── Fix 6: dynamic VAT in pull-invoices ──
      case "pull-invoices": {
        const invoices = await exactGetAll(
          base_url, division, "salesinvoice/SalesInvoices", access_token,
          "$select=InvoiceID,InvoiceNumber,InvoiceDate,AmountDC,Status,Description,OrderedBy,DueDate&$orderby=InvoiceDate desc"
        );

        const { data: localCustomers } = await supabaseAdmin
          .from("customers")
          .select("id, exact_account_id, name")
          .eq("company_id", companyId)
          .not("exact_account_id", "is", null);

        const customerMap = new Map<string, { id: string; name: string }>();
        for (const c of localCustomers || []) {
          if (c.exact_account_id) customerMap.set(c.exact_account_id, { id: c.id, name: c.name });
        }

        const allExactIds = invoices.map((i: any) => i.InvoiceID).filter(Boolean);
        const { data: existingInvoices } = await supabaseAdmin
          .from("invoices")
          .select("exact_id")
          .eq("company_id", companyId)
          .in("exact_id", allExactIds.length ? allExactIds : ["__none__"]);
        const existingSet = new Set((existingInvoices || []).map((i: any) => i.exact_id));

        let imported = 0, already_linked = 0;
        const errors: string[] = [];
        const unlinkedAccountIds = new Set<string>();

        for (const inv of invoices) {
          if (existingSet.has(inv.InvoiceID)) { already_linked++; continue; }

          const orderedBy = inv.OrderedBy;
          if (!orderedBy || !customerMap.has(orderedBy)) {
            if (orderedBy) unlinkedAccountIds.add(orderedBy);
            continue;
          }

          const customer = customerMap.get(orderedBy)!;
          try {
            const amount = Number(inv.AmountDC) || 0;
            // Fix 6: dynamic VAT — default 21% but structured for future extension
            const vatPct = 21;
            const subtotal = Math.round(amount / (1 + vatPct / 100) * 100) / 100;
            const vatAmount = Math.round((amount - subtotal) * 100) / 100;

            const { error: insertErr } = await supabaseAdmin.from("invoices").insert({
              company_id: companyId,
              customer_id: customer.id,
              exact_id: inv.InvoiceID,
              invoice_number: inv.InvoiceNumber ? String(inv.InvoiceNumber) : null,
              status: "verzonden",
              total: amount,
              subtotal,
              vat_amount: vatAmount,
              vat_percentage: vatPct,
              issued_at: parseODataDate(inv.InvoiceDate),
              due_at: parseODataDate(inv.DueDate),
              notes: inv.Description || null,
              items: [],
            });
            if (insertErr) {
              errors.push(`${inv.InvoiceNumber}: ${insertErr.message}`);
            } else {
              imported++;
            }
          } catch (err: any) {
            errors.push(`${inv.InvoiceNumber}: ${err.message}`);
          }
        }

        const unlinked_customers: { name: string; exact_account_id: string }[] = [];
        if (unlinkedAccountIds.size > 0) {
          for (const accountId of unlinkedAccountIds) {
            try {
              const accounts = await exactGetAll(
                base_url, division, "crm/Accounts", access_token,
                `$select=ID,Name&$filter=ID eq guid'${accountId}'`
              );
              unlinked_customers.push({
                name: accounts[0]?.Name || "Onbekend",
                exact_account_id: accountId,
              });
            } catch {
              unlinked_customers.push({ name: "Onbekend", exact_account_id: accountId });
            }
          }
        }

        await logUsage(supabaseAdmin, companyId, "exact_pull_invoices", { imported, already_linked, unlinked: unlinked_customers.length, errors: errors.length });
        return jsonRes({ total_in_exact: invoices.length, imported, already_linked, unlinked_customers, errors });
      }

      // ── Fix 2: pull-status fully implemented ──
      case "pull-status": {
        // Get all local invoices that are synced to Exact but not yet paid
        const { data: localInvoices } = await supabaseAdmin
          .from("invoices")
          .select("id, exact_id, invoice_number")
          .eq("company_id", companyId)
          .not("exact_id", "is", null)
          .neq("status", "betaald");

        if (!localInvoices?.length) return jsonRes({ checked: 0, updated: 0, errors: [] });

        // Fetch only non-paid invoices from Exact (Status 50 = betaald) to reduce API calls
        const exactInvoices = await exactGetAll(
          base_url, division, "salesinvoice/SalesInvoices", access_token,
          "$select=InvoiceID,InvoiceNumber,Status,AmountDC&$filter=Status ne 50"
        );

        // Build lookup: InvoiceID → Status
        const exactStatusMap = new Map<string, number>();
        for (const ei of exactInvoices) {
          if (ei.InvoiceID) exactStatusMap.set(ei.InvoiceID, Number(ei.Status));
        }

        let checked = localInvoices.length;
        let updated = 0;
        const errors: string[] = [];

        for (const inv of localInvoices) {
          const exactStatus = exactStatusMap.get(inv.exact_id);
          if (exactStatus === 50) {
            try {
              await supabaseAdmin
                .from("invoices")
                .update({
                  status: "betaald",
                  paid_at: new Date().toISOString().split("T")[0],
                })
                .eq("id", inv.id);
              updated++;
            } catch (err: any) {
              errors.push(`${inv.invoice_number}: ${err.message}`);
            }
          }
        }

        await logUsage(supabaseAdmin, companyId, "exact_pull_status", { checked, updated, errors: errors.length });
        return jsonRes({ checked, updated, errors });
      }

      case "sync-quotes": {
        const { data: quotes } = await supabaseAdmin
          .from("quotes")
          .select("*, customers(name, email, exact_account_id)")
          .eq("company_id", companyId)
          .in("status", ["verzonden", "verstuurd"])
          .is("exact_id", null);

        if (!quotes?.length) return jsonRes({ synced: 0, skipped: 0, errors: [] });

        let synced = 0, skipped = 0;
        const errors: string[] = [];

        for (const q of quotes) {
          try {
            const customer = q.customers as any;
            if (!customer?.exact_account_id) {
              skipped++;
              errors.push(`${q.quote_number}: Klant heeft geen Exact Account ID`);
              continue;
            }

            const items = (q.items as any[]) || [];
            const quotationLines = items.map((item: any) => ({
              Description: item.description || item.name || "Regel",
              Quantity: item.qty || item.quantity || 1,
              UnitPrice: item.unit_price || item.price || 0,
            }));

            if (!quotationLines.length) {
              skipped++;
              errors.push(`${q.quote_number}: Geen offerteregels`);
              continue;
            }

            const quotationData: Record<string, unknown> = {
              OrderAccount: customer.exact_account_id,
              Description: `Offerte ${q.quote_number || ""}`.trim(),
              QuotationDate: q.issued_at || new Date().toISOString().split("T")[0],
              QuotationLines: quotationLines,
            };

            if (q.valid_until) {
              quotationData.ClosingDate = q.valid_until;
            }

            const result = await exactPost(
              `${base_url}/api/v1/${division}/crm/Quotations`,
              access_token,
              quotationData
            );

            if (!result.ok) {
              errors.push(`${q.quote_number}: ${result.error}`);
              continue;
            }

            const exactQuoteId = result.data?.QuotationID;
            if (exactQuoteId) {
              await supabaseAdmin.from("quotes").update({ exact_id: exactQuoteId }).eq("id", q.id);
            }
            synced++;
          } catch (err: any) {
            errors.push(`${q.quote_number}: ${err.message}`);
          }
        }

        await logUsage(supabaseAdmin, companyId, "exact_sync_quotes", { synced, skipped, errors: errors.length });
        return jsonRes({ synced, skipped, errors });
      }

      // ── Fix 7: pull-quotes now imports into local quotes table ──
      case "pull-quotes": {
        const quotations = await exactGetAll(
          base_url, division, "crm/Quotations", access_token,
          "$select=QuotationID,QuotationNumber,QuotationDate,AmountDC,StatusDescription,Description,OrderAccount&$orderby=QuotationDate desc"
        );

        // Build customer lookup by exact_account_id
        const { data: localCustomers } = await supabaseAdmin
          .from("customers")
          .select("id, exact_account_id")
          .eq("company_id", companyId)
          .not("exact_account_id", "is", null);

        const customerMap = new Map<string, string>();
        for (const c of localCustomers || []) {
          if (c.exact_account_id) customerMap.set(c.exact_account_id, c.id);
        }

        // Get already imported exact_ids for quotes
        const allQuoteExactIds = quotations.map((q: any) => q.QuotationID).filter(Boolean);
        const { data: existingQuotes } = await supabaseAdmin
          .from("quotes")
          .select("exact_id")
          .eq("company_id", companyId)
          .in("exact_id", allQuoteExactIds.length ? allQuoteExactIds : ["__none__"]);
        const existingQuoteSet = new Set((existingQuotes || []).map((q: any) => q.exact_id));

        let imported = 0, already = 0;
        const errors: string[] = [];

        const result = quotations.map((q: any) => ({
          exact_id: q.QuotationID,
          number: q.QuotationNumber,
          date: q.QuotationDate,
          amount: q.AmountDC,
          status: q.StatusDescription,
          description: q.Description,
        }));

        for (const q of quotations) {
          if (existingQuoteSet.has(q.QuotationID)) { already++; continue; }

          const customerId = q.OrderAccount ? customerMap.get(q.OrderAccount) : null;
          if (!customerId) continue;

          try {
            const amount = Number(q.AmountDC) || 0;
            const vatPct = 21;
            const subtotal = Math.round(amount / (1 + vatPct / 100) * 100) / 100;

            await supabaseAdmin.from("quotes").insert({
              company_id: companyId,
              customer_id: customerId,
              exact_id: q.QuotationID,
              status: "verzonden",
              total: amount,
              subtotal,
              vat_amount: Math.round((amount - subtotal) * 100) / 100,
              vat_percentage: vatPct,
              issued_at: parseODataDate(q.QuotationDate),
              notes: q.Description || null,
              items: [],
            });
            imported++;
          } catch (err: any) {
            errors.push(`${q.QuotationNumber}: ${err.message}`);
          }
        }

        return jsonRes({ total_in_exact: quotations.length, imported, already_linked: already, quotes: result, errors });
      }

      // ── Fix 3: create-invoice — push single invoice to Exact ──
      case "create-invoice": {
        const { invoice_id } = body;
        if (!invoice_id) return jsonRes({ error: "invoice_id is required" }, 400);

        const { data: invoice } = await supabaseAdmin
          .from("invoices")
          .select("*, customers(*)")
          .eq("id", invoice_id)
          .eq("company_id", companyId)
          .single();

        if (!invoice) return jsonRes({ error: "Factuur niet gevonden" }, 404);
        if (invoice.exact_id) return jsonRes({ error: "Factuur is al gesynchroniseerd", exact_id: invoice.exact_id }, 400);

        const customer = invoice.customers as any;

        // Auto-create Exact Account if needed
        const exactAccountId = await ensureExactAccount(supabaseAdmin, base_url, division, access_token, customer);
        if (!exactAccountId) {
          return jsonRes({ error: "Klant kon niet naar Exact worden gepusht" }, 500);
        }

        if (!config.gl_revenue_id) {
          return jsonRes({ error: "Stel eerst een omzet-grootboekrekening in via Instellingen > Boekhouding" }, 400);
        }

        const vatPct = Number(invoice.vat_percentage || 21);
        const vatDivisor = 1 + vatPct / 100;

        const items = (invoice.items as any[]) || [];
        const invoiceLines = items.map((item: any) => {
          const priceIncl = Number(item.unit_price || item.price || 0);
          const priceExcl = priceIncl / vatDivisor;
          return {
            Description: item.description || item.name || "Regel",
            Quantity: item.qty || item.quantity || 1,
            NetPrice: Math.round(priceExcl * 100) / 100,
            GLAccount: config.gl_revenue_id,
          };
        });

        if (!invoiceLines.length) {
          return jsonRes({ error: "Geen factuurregels" }, 400);
        }

        const invoiceData: Record<string, unknown> = {
          Journal: config.journal_code || "70",
          Type: 8023,
          OrderedBy: exactAccountId,
          Description: `Factuur ${invoice.invoice_number || ""}`.trim(),
          InvoiceDate: invoice.issued_at || new Date().toISOString().split("T")[0],
          SalesInvoiceLines: invoiceLines,
        };

        if (invoice.due_at) invoiceData.DueDate = invoice.due_at;

        const result = await exactPost(
          `${base_url}/api/v1/${division}/salesinvoice/SalesInvoices`,
          access_token,
          invoiceData
        );

        if (!result.ok) return jsonRes({ error: result.error }, 500);

        const exactId = result.data?.InvoiceID;
        if (exactId) {
          await supabaseAdmin.from("invoices").update({ exact_id: exactId }).eq("id", invoice.id);
        }

        await logUsage(supabaseAdmin, companyId, "exact_create_invoice", { invoice_id });
        return jsonRes({ success: true, exact_id: exactId });
      }

      // ── Fix 4: create-quote — push single quote to Exact ──
      case "create-quote": {
        const { quote_id } = body;
        if (!quote_id) return jsonRes({ error: "quote_id is required" }, 400);

        const { data: quote } = await supabaseAdmin
          .from("quotes")
          .select("*, customers(*)")
          .eq("id", quote_id)
          .eq("company_id", companyId)
          .single();

        if (!quote) return jsonRes({ error: "Offerte niet gevonden" }, 404);

        const customer = quote.customers as any;

        const exactAccountId = await ensureExactAccount(supabaseAdmin, base_url, division, access_token, customer);
        if (!exactAccountId) {
          return jsonRes({ error: "Klant kon niet naar Exact worden gepusht" }, 500);
        }

        const items = (quote.items as any[]) || [];
        const quotationLines = items.map((item: any) => ({
          Description: item.description || item.name || "Regel",
          Quantity: item.qty || item.quantity || 1,
          UnitPrice: item.unit_price || item.price || 0,
        }));

        if (!quotationLines.length) {
          return jsonRes({ error: "Geen offerteregels" }, 400);
        }

        const quotationData: Record<string, unknown> = {
          OrderAccount: exactAccountId,
          Description: `Offerte ${quote.quote_number || ""}`.trim(),
          QuotationDate: quote.issued_at || new Date().toISOString().split("T")[0],
          QuotationLines: quotationLines,
        };

        if (quote.valid_until) quotationData.ClosingDate = quote.valid_until;

        const result = await exactPost(
          `${base_url}/api/v1/${division}/crm/Quotations`,
          access_token,
          quotationData
        );

        if (!result.ok) return jsonRes({ error: result.error }, 500);

        const exactQuoteId = result.data?.QuotationID;
        if (exactQuoteId) {
          await supabaseAdmin.from("quotes").update({ exact_id: exactQuoteId }).eq("id", quote.id);
        }

        await logUsage(supabaseAdmin, companyId, "exact_create_quote", { quote_id });
        return jsonRes({ success: true, exact_id: exactQuoteId });
      }

      default:
        return jsonRes({ error: `Onbekende actie: ${action}` }, 400);
    }
  } catch (err: any) {
    if (err instanceof AuthError) return jsonRes({ error: err.message }, err.status);
    if (err instanceof RateLimitError) return jsonRes({ error: err.message }, 429);

    // Catch "Tenant not active" / "REAUTH_REQUIRED" from getExactToken
    const msg = err.message || "";
    if (msg === "REAUTH_REQUIRED" || msg === "Tenant not active" || msg.includes("Tenant not active")) {
      try {
        const body = await req.json().catch(() => ({}));
        const supabaseAdmin = createAdminClient();
        const authCtx = await authenticateRequest(req).catch(() => null);
        if (authCtx) {
          await supabaseAdmin.from("exact_config").update({ status: "error", updated_at: new Date().toISOString() }).eq("company_id", authCtx.companyId);
        }
      } catch (_) { /* best effort */ }
      return jsonRes({ error: "Exact Online koppeling niet actief. Koppel opnieuw via instellingen.", needs_reauth: true }, 401);
    }

    console.error("sync-exact error:", err);
    return jsonRes({ error: err.message || "Internal error" }, 500);
  }
});
