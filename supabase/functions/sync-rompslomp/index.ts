import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ROMPSLOMP_BASE = "https://api.rompslomp.nl/api/v1";

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function rompslompGet(companyId: string, path: string, token: string) {
  const url = `${ROMPSLOMP_BASE}/companies/${companyId}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Rompslomp GET ${path}: ${res.status} ${errText}`);
  }
  return res.json();
}

async function rompslompPost(companyId: string, path: string, token: string, body: unknown) {
  const url = `${ROMPSLOMP_BASE}/companies/${companyId}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Rompslomp POST ${path}: ${res.status} ${errText}`);
  }
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonRes({ error: "Method not allowed" }, 405);
  }

  try {
    // Authenticate user via JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonRes({ error: "Niet ingelogd" }, 401);
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return jsonRes({ error: "Niet ingelogd" }, 401);
    }
    const userId = claimsData.claims.sub;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get company with rompslomp config
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .single();

    if (!profile?.company_id) {
      return jsonRes({ error: "Geen bedrijf gevonden" }, 400);
    }

    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("id, rompslomp_api_token, rompslomp_company_id")
      .eq("id", profile.company_id)
      .single();

    if (!company?.rompslomp_api_token || !company?.rompslomp_company_id) {
      return jsonRes({ error: "Rompslomp is niet gekoppeld — vul API token en Company ID in bij Instellingen > Koppelingen" }, 400);
    }

    const body = await req.json();
    const { action } = body;

    const apiToken = company.rompslomp_api_token;
    const rompslompCompanyId = company.rompslomp_company_id;

    // Action: auto-detect companies (token provided in body, not yet saved)
    if (action === "auto-detect") {
      const tokenToUse = body.token || apiToken;
      if (!tokenToUse) {
        return jsonRes({ error: "Geen API token opgegeven" }, 400);
      }
      const url = `${ROMPSLOMP_BASE}/companies`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${tokenToUse}`, Accept: "application/json" },
      });
      if (!res.ok) {
        const errText = await res.text();
        return jsonRes({ error: `Rompslomp API fout: ${res.status} ${errText}` }, 400);
      }
      const result = await res.json();
      const companies = Array.isArray(result) ? result : (result?.companies || result?.data || []);
      return jsonRes({ companies: companies.map((c: any) => ({ id: String(c.id), name: c.name || c.company_name || `Bedrijf ${c.id}` })) });
    }

    // Action: test connection
    if (action === "test") {
      await rompslompGet(rompslompCompanyId, "/contacts?page=1&per_page=1", apiToken);
      return jsonRes({ success: true });
    }

    // Action: sync contacts (push to Rompslomp)
    if (action === "sync-contacts") {
      const { data: customers } = await supabaseAdmin
        .from("customers")
        .select("*")
        .eq("company_id", company.id)
        .is("rompslomp_contact_id", null);

      let synced = 0;
      const errors: string[] = [];

      for (const cust of customers || []) {
        try {
          const contactData: any = {
            company_name: cust.type === "zakelijk" ? cust.name : undefined,
            first_name: cust.contact_person || cust.name,
            email: cust.email || undefined,
            phone: cust.phone || undefined,
            address: cust.address || undefined,
            zipcode: cust.postal_code || undefined,
            city: cust.city || undefined,
          };
          const result = await rompslompPost(rompslompCompanyId, "/contacts", apiToken, { contact: contactData });
          const contactId = result?.id || result?.contact?.id;
          if (contactId) {
            await supabaseAdmin.from("customers").update({ rompslomp_contact_id: String(contactId) }).eq("id", cust.id);
            synced++;
          }
        } catch (err: any) {
          errors.push(`${cust.name}: ${err.message}`);
        }
      }

      return jsonRes({ synced, skipped: 0, errors });
    }

    // Action: sync invoices (push to Rompslomp)
    if (action === "sync-invoices") {
      const { data: invoices } = await supabaseAdmin
        .from("invoices")
        .select("*, customers(id, name, rompslomp_contact_id)")
        .eq("company_id", company.id)
        .is("rompslomp_id", null);

      let synced = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const inv of invoices || []) {
        try {
          const customer = inv.customers as any;
          if (!customer?.rompslomp_contact_id) {
            skipped++;
            continue;
          }

          const vatPct = Number(inv.vat_percentage || 21);
          const items = Array.isArray(inv.items) ? inv.items : [];
          const invoiceLines = items.map((item: any) => ({
            description: item.description || "Item",
            quantity: String(item.qty || 1),
            price_per_unit: String(Number(item.unit_price || 0) / (1 + vatPct / 100)),
          }));
          const invoiceData: any = {
            contact_id: parseInt(customer.rompslomp_contact_id),
            invoice_number: inv.invoice_number,
            date: inv.issued_at || new Date().toISOString().split("T")[0],
            due_date: inv.due_at || undefined,
            invoice_lines: invoiceLines,
          };

          const result = await rompslompPost(rompslompCompanyId, "/sales_invoices", apiToken, { sales_invoice: invoiceData });
          const rompslompId = result?.id || result?.sales_invoice?.id;
          if (rompslompId) {
            await supabaseAdmin.from("invoices").update({ rompslomp_id: String(rompslompId) }).eq("id", inv.id);
            synced++;
          }
        } catch (err: any) {
          errors.push(`${inv.invoice_number || inv.id}: ${err.message}`);
        }
      }

      return jsonRes({ synced, skipped, errors });
    }

    // Action: pull contacts (from Rompslomp)
    if (action === "pull-contacts") {
      let page = 1;
      let allContacts: any[] = [];
      while (true) {
        const result = await rompslompGet(rompslompCompanyId, `/contacts?page=${page}&per_page=100`, apiToken);
        const contacts = result?.contacts || result || [];
        if (!Array.isArray(contacts) || contacts.length === 0) break;
        allContacts = allContacts.concat(contacts);
        if (contacts.length < 100) break;
        page++;
      }

      let created = 0, updated = 0;
      const errors: string[] = [];

      for (const contact of allContacts) {
        try {
          const contactId = String(contact.id);
          const customerData: any = {
            name: contact.company_name || `${contact.first_name || ""} ${contact.last_name || ""}`.trim() || `Contact ${contactId}`,
            contact_person: contact.first_name ? `${contact.first_name} ${contact.last_name || ""}`.trim() : null,
            email: contact.email || null,
            phone: contact.phone || null,
            address: contact.address || null,
            postal_code: contact.zipcode || null,
            city: contact.city || null,
            rompslomp_contact_id: contactId,
          };

          const { data: existing } = await supabaseAdmin
            .from("customers")
            .select("id")
            .eq("rompslomp_contact_id", contactId)
            .eq("company_id", company.id)
            .maybeSingle();

          if (existing) {
            await supabaseAdmin.from("customers").update(customerData).eq("id", existing.id);
            updated++;
          } else {
            customerData.company_id = company.id;
            await supabaseAdmin.from("customers").insert(customerData);
            created++;
          }
        } catch (err: any) {
          errors.push(`Contact ${contact.id}: ${err.message}`);
        }
      }

      return jsonRes({ total: allContacts.length, created, updated, errors });
    }

    // Action: pull invoices (from Rompslomp)
    if (action === "pull-invoices") {
      let page = 1;
      let allInvoices: any[] = [];
      while (true) {
        const result = await rompslompGet(rompslompCompanyId, `/sales_invoices?page=${page}&per_page=100`, apiToken);
        const invoices = result?.sales_invoices || result || [];
        if (!Array.isArray(invoices) || invoices.length === 0) break;
        allInvoices = allInvoices.concat(invoices);
        if (invoices.length < 100) break;
        page++;
      }

      // Find existing imports — also re-sync ones with subtotal=0 (broken earlier imports)
      const { data: existingInvoices } = await supabaseAdmin
        .from("invoices")
        .select("id, rompslomp_id, subtotal")
        .eq("company_id", company.id)
        .not("rompslomp_id", "is", null);

      const existingMap = new Map<string, { id: string; subtotal: number }>();
      for (const ei of existingInvoices || []) {
        existingMap.set(String(ei.rompslomp_id), { id: ei.id, subtotal: Number(ei.subtotal) });
      }

      let imported = 0;
      let updatedExisting = 0;
      let skippedNoCustomer = 0;
      const errors: string[] = [];

      for (const rInvSummary of allInvoices) {
        try {
          const rompId = String(rInvSummary.id);
          const existing = existingMap.get(rompId);

          // Skip if already imported AND has valid amounts
          if (existing && existing.subtotal > 0) continue;

          // Fetch full invoice detail to get invoice_lines
          const fullResult = await rompslompGet(rompslompCompanyId, `/sales_invoices/${rInvSummary.id}`, apiToken);
          const rInv = fullResult?.sales_invoice || fullResult;

          const contactId = rInv.contact_id ? String(rInv.contact_id) : null;
          let customer = null;
          if (contactId) {
            const { data } = await supabaseAdmin
              .from("customers")
              .select("id")
              .eq("rompslomp_contact_id", contactId)
              .eq("company_id", company.id)
              .maybeSingle();
            customer = data;
          }

          if (!customer) {
            skippedNoCustomer++;
            continue;
          }

          const subtotal = Number(rInv.price_without_vat ?? rInv.total_without_tax ?? 0);
          const total = Number(rInv.price_with_vat ?? rInv.total_with_tax ?? 0);
          const vatAmount = Number(rInv.vat_amount ?? (total - subtotal));

          // Convert invoice_lines to our items format
          const rLines = rInv.invoice_lines || rInv.lines || [];
          const items = Array.isArray(rLines) ? rLines.map((line: any) => ({
            description: line.description || "Item",
            qty: Number(line.quantity || 1),
            unit_price: Number(line.price_per_unit || line.price || 0) * (1 + (Number(line.vat_percentage || 21) / 100)),
            total: Number(line.price_with_vat || line.total_with_vat || 0),
          })) : [];

          const isPaid = rInv.payment_status === "paid" || rInv.paid_at;
          const invoiceData: any = {
            customer_id: customer.id,
            company_id: company.id,
            rompslomp_id: rompId,
            invoice_number: rInv.invoice_number || null,
            subtotal,
            total,
            vat_amount: vatAmount,
            items,
            status: isPaid ? "betaald" : "verzonden",
            issued_at: rInv.date || rInv.invoice_date || null,
            paid_at: rInv.paid_at || (isPaid ? new Date().toISOString().split("T")[0] : null),
          };

          if (existing) {
            // Update existing broken import
            await supabaseAdmin.from("invoices").update(invoiceData).eq("id", existing.id);
            updatedExisting++;
          } else {
            await supabaseAdmin.from("invoices").insert(invoiceData);
            imported++;
          }
        } catch (err: any) {
          errors.push(`Invoice ${rInvSummary.id}: ${err.message}`);
        }
      }

      return jsonRes({
        total_in_rompslomp: allInvoices.length,
        already_imported: existingMap.size - updatedExisting,
        imported,
        updated_existing: updatedExisting,
        skipped_no_customer: skippedNoCustomer,
        errors,
      });
    }

    // Action: pull invoice status
    if (action === "pull-invoice-status") {
      const { data: unpaid } = await supabaseAdmin
        .from("invoices")
        .select("id, rompslomp_id")
        .eq("company_id", company.id)
        .not("rompslomp_id", "is", null)
        .neq("status", "betaald");

      let checked = 0, updated = 0;
      const errors: string[] = [];

      for (const inv of unpaid || []) {
        try {
          const rInv = await rompslompGet(rompslompCompanyId, `/sales_invoices/${inv.rompslomp_id}`, apiToken);
          const invoiceData = rInv?.sales_invoice || rInv;
          checked++;
          if (invoiceData.payment_status === "paid" || invoiceData.paid_at) {
            await supabaseAdmin
              .from("invoices")
              .update({ status: "betaald", paid_at: invoiceData.paid_at || new Date().toISOString().split("T")[0] })
              .eq("id", inv.id);
            updated++;
          }
        } catch (err: any) {
          errors.push(`Invoice ${inv.rompslomp_id}: ${err.message}`);
        }
      }

      return jsonRes({ checked, updated, errors });
    }

    return jsonRes({ error: `Onbekende actie: ${action}` }, 400);
  } catch (err: any) {
    console.error("sync-rompslomp error:", err.message);
    return jsonRes({ error: err.message }, 500);
  }
});
