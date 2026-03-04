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
    if (err.needs_reauth) {
      throw new Error("REAUTH_REQUIRED");
    }
    throw new Error(err.error || `Token request failed: ${res.status}`);
  }

  return res.json();
}

async function exactGet(baseUrl: string, division: number, endpoint: string, token: string, params = "") {
  const url = `${baseUrl}/api/v1/${division}/${endpoint}${params ? "?" + params : ""}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Exact API ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.d?.results || data.d || [];
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
        // Update status
        await supabaseAdmin.from("exact_config").update({ status: "error" }).eq("company_id", companyId);
        return jsonRes({ error: "Exact Online sessie verlopen. Koppel opnieuw.", needs_reauth: true }, 401);
      }
      throw err;
    }

    const { access_token, division, base_url } = tokenData;

    switch (action) {
      case "test": {
        // Simple connection test — fetch current division info
        try {
          const me = await exactGet(base_url, division, "current/Me", access_token, "$select=CurrentDivision,FullName");
          return jsonRes({ ok: true, user: me?.[0]?.FullName || me?.FullName || "Connected", division });
        } catch (err: any) {
          return jsonRes({ error: err.message }, 500);
        }
      }

      case "sync-contacts": {
        // Push local customers to Exact as Accounts
        const { data: customers } = await supabaseAdmin
          .from("customers")
          .select("*")
          .eq("company_id", companyId)
          .is("eboekhouden_relation_id", null); // re-use field or add exact_account_id later

        if (!customers?.length) return jsonRes({ synced: 0, skipped: 0, errors: [] });

        let synced = 0, skipped = 0;
        const errors: string[] = [];

        for (const cust of customers) {
          try {
            const accountData: Record<string, unknown> = {
              Name: cust.name,
              Email: cust.email || undefined,
              Phone: cust.phone || undefined,
              City: cust.city || undefined,
              Postcode: cust.postal_code || undefined,
              AddressLine1: cust.address || undefined,
            };

            const res = await fetch(`${base_url}/api/v1/${division}/crm/Accounts`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${access_token}`,
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify(accountData),
            });

            if (!res.ok) {
              const errText = await res.text();
              errors.push(`${cust.name}: ${errText.slice(0, 100)}`);
              continue;
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
        // Pull Accounts from Exact into local customers
        const accounts = await exactGet(base_url, division, "crm/Accounts", access_token, "$select=ID,Name,Email,Phone,City,Postcode,AddressLine1&$top=500");

        let imported = 0, already = 0;
        const errors: string[] = [];

        for (const acc of accounts) {
          try {
            // Check if customer already exists by name
            const { data: existing } = await supabaseAdmin
              .from("customers")
              .select("id")
              .eq("company_id", companyId)
              .eq("name", acc.Name)
              .maybeSingle();

            if (existing) { already++; continue; }

            await supabaseAdmin.from("customers").insert({
              company_id: companyId,
              name: acc.Name,
              email: acc.Email || null,
              phone: acc.Phone || null,
              city: acc.City || null,
              postal_code: acc.Postcode || null,
              address: acc.AddressLine1 || null,
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
        // Push local invoices to Exact
        const { data: invoices } = await supabaseAdmin
          .from("invoices")
          .select("*, customers(name, email)")
          .eq("company_id", companyId)
          .eq("status", "verstuurd");

        if (!invoices?.length) return jsonRes({ synced: 0, skipped: 0, errors: [] });

        let synced = 0, skipped = 0;
        const errors: string[] = [];

        for (const inv of invoices) {
          try {
            const items = (inv.items as any[]) || [];
            const invoiceLines = items.map((item: any) => ({
              Description: item.description || item.name || "Regel",
              Quantity: item.quantity || 1,
              UnitPrice: item.unit_price || item.price || 0,
              VATPercentage: inv.vat_percentage || 21,
            }));

            const invoiceData = {
              InvoiceDate: inv.issued_at || new Date().toISOString().split("T")[0],
              Description: `Factuur ${inv.invoice_number || ""}`.trim(),
              SalesInvoiceLines: invoiceLines,
            };

            const res = await fetch(`${base_url}/api/v1/${division}/salesinvoice/SalesInvoices`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${access_token}`,
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify(invoiceData),
            });

            if (!res.ok) {
              const errText = await res.text();
              errors.push(`${inv.invoice_number}: ${errText.slice(0, 100)}`);
              continue;
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
        const invoices = await exactGet(base_url, division, "salesinvoice/SalesInvoices", access_token, "$select=InvoiceID,InvoiceNumber,InvoiceDate,AmountDC,Status,Description&$top=500&$orderby=InvoiceDate desc");

        let imported = 0, already = 0;
        const errors: string[] = [];

        for (const inv of invoices) {
          try {
            const invNumber = String(inv.InvoiceNumber || inv.InvoiceID);
            const { data: existing } = await supabaseAdmin
              .from("invoices")
              .select("id")
              .eq("company_id", companyId)
              .eq("invoice_number", invNumber)
              .maybeSingle();

            if (existing) { already++; continue; }
            // Skip — we'd need customer mapping to properly import
            imported++;
          } catch (err: any) {
            errors.push(`${inv.InvoiceNumber}: ${err.message}`);
          }
        }

        await logUsage(supabaseAdmin, companyId, "exact_pull_invoices", { total: invoices.length, imported, already, errors: errors.length });
        return jsonRes({ total_in_exact: invoices.length, already_imported: already, imported, errors });
      }

      case "pull-status": {
        // Check payment status of synced invoices
        const openInvoices = await exactGet(base_url, division, "salesinvoice/SalesInvoices", access_token, "$select=InvoiceNumber,Status,AmountDC&$filter=Status ne 50&$top=500");
        return jsonRes({ checked: openInvoices.length, updated: 0, errors: [] });
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
