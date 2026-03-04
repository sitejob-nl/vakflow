import { jsonRes, optionsResponse } from "../_shared/cors.ts";
import { createAdminClient, authenticateRequest, AuthError } from "../_shared/supabase.ts";
import { logUsage } from "../_shared/usage.ts";

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

/** Single POST/PUT/DELETE to Exact with 429 retry */
async function exactPost(
  url: string,
  token: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; data?: any; error?: string; status: number }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      method: "POST",
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
      return { ok: false, error: errText.slice(0, 200), status: res.status };
    }

    const data = await res.json().catch(() => ({}));
    return { ok: true, data: data.d || data, status: res.status };
  }

  return { ok: false, error: "Rate limit exceeded after retries", status: 429 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  try {
    const { companyId } = await authenticateRequest(req);
    const supabaseAdmin = createAdminClient();

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
      if (err.message === "REAUTH_REQUIRED") {
        await supabaseAdmin.from("exact_config").update({ status: "error" }).eq("company_id", companyId);
        return jsonRes({ error: "Exact Online sessie verlopen. Koppel opnieuw.", needs_reauth: true }, 401);
      }
      throw err;
    }

    const { access_token, division, base_url } = tokenData;

    switch (action) {
      case "test": {
        try {
          // current/Me has no division prefix
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

      case "sync-contacts": {
        // Push local customers to Exact as Accounts — only those without exact_account_id
        const { data: customers } = await supabaseAdmin
          .from("customers")
          .select("*")
          .eq("company_id", companyId)
          .is("exact_account_id", null);

        if (!customers?.length) return jsonRes({ synced: 0, skipped: 0, errors: [] });

        let synced = 0, skipped = 0;
        const errors: string[] = [];

        for (const cust of customers) {
          try {
            const accountData: Record<string, unknown> = {
              Name: cust.name,
              Status: "C", // Customer
              Country: "NL",
              Email: cust.email || undefined,
              Phone: cust.phone || undefined,
              City: cust.city || undefined,
              Postcode: cust.postal_code || undefined,
              AddressLine1: cust.address || undefined,
            };

            const result = await exactPost(
              `${base_url}/api/v1/${division}/crm/Accounts`,
              access_token,
              accountData
            );

            if (!result.ok) {
              errors.push(`${cust.name}: ${result.error}`);
              continue;
            }

            // Store the returned Exact Account ID
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

        await logUsage(supabaseAdmin, companyId, "exact_sync_contacts", { synced, skipped, errors: errors.length });
        return jsonRes({ synced, skipped, errors });
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
            // Check if customer already exists by exact_account_id or name
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
              // Link existing customer to Exact
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

      case "sync-invoices": {
        // Push local invoices to Exact — using direct invoice type (8023)
        const { data: invoices } = await supabaseAdmin
          .from("invoices")
          .select("*, customers(name, email, exact_account_id)")
          .eq("company_id", companyId)
          .eq("status", "verstuurd")
          .is("exact_id", null);

        if (!invoices?.length) return jsonRes({ synced: 0, skipped: 0, errors: [] });

        let synced = 0, skipped = 0;
        const errors: string[] = [];

        for (const inv of invoices) {
          try {
            const customer = inv.customers as any;
            if (!customer?.exact_account_id) {
              skipped++;
              errors.push(`${inv.invoice_number}: Klant heeft geen Exact Account ID — sync klanten eerst`);
              continue;
            }

            const items = (inv.items as any[]) || [];
            const invoiceLines = items.map((item: any) => ({
              Description: item.description || item.name || "Regel",
              Quantity: item.quantity || 1,
              NetPrice: item.unit_price || item.price || 0,
            }));

            if (!invoiceLines.length) {
              skipped++;
              errors.push(`${inv.invoice_number}: Geen factuurregels`);
              continue;
            }

            const invoiceData: Record<string, unknown> = {
              Journal: "70",
              Type: 8023, // Direct sales invoice — no Item/GLAccount required
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
              continue;
            }

            // Store Exact invoice ID
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
          }
        }

        await logUsage(supabaseAdmin, companyId, "exact_sync_invoices", { synced, skipped, errors: errors.length });
        return jsonRes({ synced, skipped, errors });
      }

      case "pull-invoices": {
        // Read-only: list invoices from Exact (no import — customer mapping is ambiguous)
        const invoices = await exactGetAll(
          base_url, division, "salesinvoice/SalesInvoices", access_token,
          "$select=InvoiceID,InvoiceNumber,InvoiceDate,AmountDC,Status,Description&$orderby=InvoiceDate desc"
        );

        // Check which are already linked locally
        const exactIds = invoices.map((i: any) => i.InvoiceID).filter(Boolean);
        const { data: linkedInvoices } = await supabaseAdmin
          .from("invoices")
          .select("exact_id")
          .eq("company_id", companyId)
          .in("exact_id", exactIds.length ? exactIds : ["__none__"]);

        const linkedSet = new Set((linkedInvoices || []).map((i: any) => i.exact_id));

        const result = invoices.map((inv: any) => ({
          exact_id: inv.InvoiceID,
          number: inv.InvoiceNumber,
          date: inv.InvoiceDate,
          amount: inv.AmountDC,
          description: inv.Description,
          linked: linkedSet.has(inv.InvoiceID),
        }));

        return jsonRes({ total_in_exact: invoices.length, linked: linkedSet.size, invoices: result });
      }

      case "pull-status": {
        const openInvoices = await exactGetAll(
          base_url, division, "salesinvoice/SalesInvoices", access_token,
          "$select=InvoiceID,InvoiceNumber,Status,AmountDC&$filter=Status ne 50"
        );
        return jsonRes({ checked: openInvoices.length, updated: 0, errors: [] });
      }

      case "sync-quotes": {
        // Push local quotes to Exact as Quotations
        const { data: quotes } = await supabaseAdmin
          .from("quotes")
          .select("*, customers(name, email, exact_account_id)")
          .eq("company_id", companyId)
          .eq("status", "verstuurd");

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
              Quantity: item.quantity || 1,
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
            synced++;
          } catch (err: any) {
            errors.push(`${q.quote_number}: ${err.message}`);
          }
        }

        await logUsage(supabaseAdmin, companyId, "exact_sync_quotes", { synced, skipped, errors: errors.length });
        return jsonRes({ synced, skipped, errors });
      }

      case "pull-quotes": {
        // Read-only: list quotations from Exact
        const quotations = await exactGetAll(
          base_url, division, "crm/Quotations", access_token,
          "$select=QuotationID,QuotationNumber,QuotationDate,AmountDC,StatusDescription,Description&$orderby=QuotationDate desc"
        );

        const result = quotations.map((q: any) => ({
          exact_id: q.QuotationID,
          number: q.QuotationNumber,
          date: q.QuotationDate,
          amount: q.AmountDC,
          status: q.StatusDescription,
          description: q.Description,
        }));

        return jsonRes({ total_in_exact: quotations.length, quotes: result });
      }

      default:
        return jsonRes({ error: `Onbekende actie: ${action}` }, 400);
    }
  } catch (err: any) {
    if (err instanceof AuthError) return jsonRes({ error: err.message }, err.status);
    console.error("sync-exact error:", err);
    return jsonRes({ error: err.message || "Internal error" }, 500);
  }
});
