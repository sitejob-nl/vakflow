import { corsHeaders, jsonRes, optionsResponse } from "../_shared/cors.ts";
import { createAdminClient, authenticateRequest, AuthError } from "../_shared/supabase.ts";
import { logEdgeFunctionError } from "../_shared/error-logger.ts";
import { decrypt } from "../_shared/crypto.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";

const ROMPSLOMP_BASE = "https://api.rompslomp.nl/api/v1";

interface RompslompResponse<T = unknown> {
  data: T;
  total: number | null;
  perPage: number;
}

async function rompslompGet<T = unknown>(companyId: string, path: string, token: string): Promise<RompslompResponse<T>> {
  const url = `${ROMPSLOMP_BASE}/companies/${companyId}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Rompslomp GET ${path}: ${res.status} ${errText}`);
  }
  const data = await res.json() as T;
  const total = res.headers.get("X-Total") ? parseInt(res.headers.get("X-Total")!) : null;
  const perPage = res.headers.get("X-Per-Page") ? parseInt(res.headers.get("X-Per-Page")!) : 100;
  return { data, total, perPage };
}

async function rompslompGetRaw(companyId: string, path: string, token: string): Promise<ArrayBuffer> {
  const url = `${ROMPSLOMP_BASE}/companies/${companyId}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/pdf" },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Rompslomp GET ${path}: ${res.status} ${errText}`);
  }
  return res.arrayBuffer();
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
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonRes({ error: "Method not allowed" }, 405);

  try {
    const { userId, companyId } = await authenticateRequest(req);
    const supabaseAdmin = createAdminClient();

    // Rate limit: max 5 syncs per minute per company
    await checkRateLimit(supabaseAdmin, companyId, "sync_rompslomp", 5);

    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("id, rompslomp_api_token, rompslomp_company_id")
      .eq("id", companyId)
      .single();

    if (!company?.rompslomp_api_token || !company?.rompslomp_company_id) {
      return jsonRes({ error: "Rompslomp is niet gekoppeld — vul API token en Company ID in bij Instellingen > Koppelingen" }, 400);
    }

    const body = await req.json();
    const { action } = body;

    // Decrypt stored token (may be encrypted or plaintext for legacy data)
    let apiToken: string;
    try {
      apiToken = company.rompslomp_api_token.includes(":")
        ? await decrypt(company.rompslomp_api_token)
        : company.rompslomp_api_token;
    } catch {
      apiToken = company.rompslomp_api_token;
    }
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

    // Action: sync single customer (push to Rompslomp)
    if (action === "sync-customer") {
      const { customer_id } = body;
      if (!customer_id) return jsonRes({ error: "customer_id is verplicht" }, 400);

      const { data: cust, error: custErr } = await supabaseAdmin
        .from("customers")
        .select("*")
        .eq("id", customer_id)
        .single();
      if (custErr || !cust) return jsonRes({ error: `Klant niet gevonden: ${custErr?.message}` }, 400);

      if (cust.rompslomp_contact_id) {
        return jsonRes({ success: true, skipped: true, message: "Contact bestaat al in Rompslomp" });
      }

      const isIndividual = cust.type === "particulier";
      const contactData: any = {
        is_individual: isIndividual,
        is_supplier: false,
        company_name: !isIndividual ? cust.name : undefined,
        contact_person_name: isIndividual ? cust.name : (cust.contact_person || undefined),
        contact_person_email_address: cust.email || undefined,
        contact_number: cust.phone || undefined,
        address: cust.address || undefined,
        zipcode: cust.postal_code || undefined,
        city: cust.city || undefined,
        api_reference: cust.id,
      };

      const result = await rompslompPost(rompslompCompanyId, "/contacts", apiToken, { contact: contactData });
      const contactId = result?.id || result?.contact?.id;
      if (contactId) {
        await supabaseAdmin.from("customers").update({ rompslomp_contact_id: String(contactId) }).eq("id", cust.id);
      }

      return jsonRes({ success: true, rompslomp_contact_id: contactId ? String(contactId) : null });
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
          const isIndividual = cust.type === "particulier";
          const contactData: any = {
            is_individual: isIndividual,
            is_supplier: false,
            company_name: !isIndividual ? cust.name : undefined,
            contact_person_name: isIndividual ? cust.name : (cust.contact_person || undefined),
            contact_person_email_address: cust.email || undefined,
            contact_number: cust.phone || undefined,
            address: cust.address || undefined,
            zipcode: cust.postal_code || undefined,
            city: cust.city || undefined,
            api_reference: cust.id,
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

      console.log(`sync-invoices: found ${invoices?.length ?? 0} invoices without rompslomp_id`);

      let synced = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const inv of invoices || []) {
        try {
          const customer = inv.customers as any;
          if (!customer?.rompslomp_contact_id) {
            console.log(`Skipping invoice ${inv.invoice_number}: no rompslomp_contact_id on customer`);
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
            date: inv.issued_at || new Date().toISOString().split("T")[0],
            due_date: inv.due_at || undefined,
            invoice_lines: invoiceLines,
            api_reference: inv.invoice_number || undefined,
            _publish: true,
          };

          console.log(`Pushing invoice ${inv.invoice_number} to Rompslomp:`, JSON.stringify(invoiceData));

          const result = await rompslompPost(rompslompCompanyId, "/sales_invoices", apiToken, { sales_invoice: invoiceData });
          const rompslompId = result?.id || result?.sales_invoice?.id;
          if (rompslompId) {
            await supabaseAdmin.from("invoices").update({ rompslomp_id: String(rompslompId) }).eq("id", inv.id);
            synced++;
            console.log(`Invoice ${inv.invoice_number} synced, rompslomp_id: ${rompslompId}`);
          } else {
            console.log(`Invoice ${inv.invoice_number}: no rompslomp_id in response`, JSON.stringify(result));
            errors.push(`${inv.invoice_number}: Geen ID in Rompslomp response`);
          }
        } catch (err: any) {
          console.error(`Invoice ${inv.invoice_number || inv.id} sync error:`, err.message);
          errors.push(`${inv.invoice_number || inv.id}: ${err.message}`);
        }
      }

      return jsonRes({ synced, skipped, errors });
    }

    // Action: pull contacts (from Rompslomp)
    if (action === "pull-contacts") {
      let page = 1;
      let allContacts: any[] = [];
      const PER_PAGE = 100;
      let totalRecords: number | null = null;
      while (true) {
        const { data: result, total, perPage } = await rompslompGet(rompslompCompanyId, `/contacts?page=${page}&per_page=${PER_PAGE}`, apiToken);
        const contacts = (result as any)?.contacts || result || [];
        if (!Array.isArray(contacts) || contacts.length === 0) break;
        allContacts = allContacts.concat(contacts);
        if (totalRecords === null && total !== null) totalRecords = total;
        // Stop als we alles hebben (header-based) of fallback op length
        if (totalRecords !== null ? allContacts.length >= totalRecords : contacts.length < (perPage || PER_PAGE)) break;
        page++;
      }

      let created = 0, updated = 0;
      const errors: string[] = [];

      for (const contact of allContacts) {
        try {
          const contactId = String(contact.id);
          const customerData: any = {
            name: contact.company_name || contact.contact_person_name || contact.name || `Contact ${contactId}`,
            contact_person: contact.contact_person_name || null,
            email: contact.contact_person_email_address || null,
            phone: contact.contact_number || null,
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
      const PER_PAGE = 100;
      let totalRecords: number | null = null;
      while (true) {
        const { data: result, total, perPage } = await rompslompGet(rompslompCompanyId, `/sales_invoices?page=${page}&per_page=${PER_PAGE}`, apiToken);
        const invoices = (result as any)?.sales_invoices || result || [];
        if (!Array.isArray(invoices) || invoices.length === 0) break;
        allInvoices = allInvoices.concat(invoices);
        if (totalRecords === null && total !== null) totalRecords = total;
        if (totalRecords !== null ? allInvoices.length >= totalRecords : invoices.length < (perPage || PER_PAGE)) break;
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

          // Fetch full invoice detail to get lines
          const { data: fullResult } = await rompslompGet(rompslompCompanyId, `/sales_invoices/${rInvSummary.id}`, apiToken);
          const rInv = (fullResult as any)?.sales_invoice || fullResult;

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

          const subtotal = Number(rInv.total_price_without_vat ?? 0);
          const total = Number(rInv.total_price_with_vat ?? 0);
          const vatAmount = total - subtotal;

          // Convert lines to our items format
          const rLines = rInv.invoice_lines || rInv.lines || [];
          const items = Array.isArray(rLines) ? rLines.map((line: any) => ({
            description: line.description || "Item",
            qty: Number(line.quantity || line.amount || 1),
            unit_price: Number(line.price_per_unit || 0) * (1 + (Number(line.vat_percentage || 21) / 100)),
            total: Number(line.price_with_vat || 0),
          })) : [];

          const isPaid = parseFloat(rInv.open_amount || "1") === 0;
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
            issued_at: rInv.date || null,
            paid_at: isPaid ? new Date().toISOString().split("T")[0] : null,
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
          const { data: rInv } = await rompslompGet(rompslompCompanyId, `/sales_invoices/${inv.rompslomp_id}`, apiToken);
          const invoiceData = (rInv as any)?.sales_invoice || rInv;
          checked++;
          const isPaid = parseFloat(invoiceData.open_amount || "1") === 0;
          if (isPaid) {
            await supabaseAdmin
              .from("invoices")
              .update({ status: "betaald", paid_at: new Date().toISOString().split("T")[0] })
              .eq("id", inv.id);
            updated++;
          }
        } catch (err: any) {
          errors.push(`Invoice ${inv.rompslomp_id}: ${err.message}`);
        }
      }

      return jsonRes({ checked, updated, errors });
    }

    // Action: sync quotes (push to Rompslomp)
    if (action === "sync-quotes") {
      const { data: quotes } = await supabaseAdmin
        .from("quotes")
        .select("*, customers(id, name, rompslomp_contact_id)")
        .eq("company_id", company.id)
        .is("rompslomp_id", null);

      console.log(`sync-quotes: found ${quotes?.length ?? 0} quotes without rompslomp_id`);

      let synced = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const quote of quotes || []) {
        try {
          const customer = quote.customers as any;
          if (!customer?.rompslomp_contact_id) {
            skipped++;
            continue;
          }

          const vatPct = Number(quote.vat_percentage || 21);
          const items = Array.isArray(quote.items) ? quote.items : [];
          const quoteLines = items.map((item: any) => ({
            description: item.description || "Item",
            quantity: String(item.qty || 1),
            price_per_unit: String(Number(item.unit_price || 0) / (1 + vatPct / 100)),
          }));
          const quotationData: any = {
            contact_id: parseInt(customer.rompslomp_contact_id),
            date: quote.issued_at || new Date().toISOString().split("T")[0],
            invoice_lines: quoteLines,
            api_reference: quote.quote_number || undefined,
            _publish: true,
          };

          console.log(`Pushing quote ${quote.quote_number} to Rompslomp:`, JSON.stringify(quotationData));

          const result = await rompslompPost(rompslompCompanyId, "/quotations", apiToken, { quotation: quotationData });
          const rompslompId = result?.id || result?.quotation?.id;
          if (rompslompId) {
            await supabaseAdmin.from("quotes").update({ rompslomp_id: String(rompslompId) }).eq("id", quote.id);
            synced++;
          } else {
            errors.push(`${quote.quote_number}: Geen ID in Rompslomp response`);
          }
        } catch (err: any) {
          console.error(`Quote ${quote.quote_number || quote.id} sync error:`, err.message);
          errors.push(`${quote.quote_number || quote.id}: ${err.message}`);
        }
      }

      return jsonRes({ synced, skipped, errors });
    }

    // Action: pull quotes (from Rompslomp)
    if (action === "pull-quotes") {
      let page = 1;
      let allQuotations: any[] = [];
      const PER_PAGE = 100;
      let totalRecords: number | null = null;
      while (true) {
        const { data: result, total, perPage } = await rompslompGet(rompslompCompanyId, `/quotations?page=${page}&per_page=${PER_PAGE}`, apiToken);
        const quotations = (result as any)?.quotations || result || [];
        if (!Array.isArray(quotations) || quotations.length === 0) break;
        allQuotations = allQuotations.concat(quotations);
        if (totalRecords === null && total !== null) totalRecords = total;
        if (totalRecords !== null ? allQuotations.length >= totalRecords : quotations.length < (perPage || PER_PAGE)) break;
        page++;
      }

      const { data: existingQuotes } = await supabaseAdmin
        .from("quotes")
        .select("id, rompslomp_id")
        .eq("company_id", company.id)
        .not("rompslomp_id", "is", null);

      const existingSet = new Set((existingQuotes || []).map(q => String(q.rompslomp_id)));

      let imported = 0;
      let skippedNoCustomer = 0;
      const errors: string[] = [];

      for (const rQuote of allQuotations) {
        try {
          const rompId = String(rQuote.id);
          if (existingSet.has(rompId)) continue;

          // Fetch full detail
          const { data: fullResult } = await rompslompGet(rompslompCompanyId, `/quotations/${rQuote.id}`, apiToken);
          const rQ = (fullResult as any)?.quotation || fullResult;

          const contactId = rQ.contact_id ? String(rQ.contact_id) : null;
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

          const subtotal = Number(rQ.total_price_without_vat ?? 0);
          const total = Number(rQ.total_price_with_vat ?? 0);
          const vatAmount = total - subtotal;

          const rLines = rQ.lines || [];
          const pullVatPct = total > 0 && subtotal > 0 ? Math.round(((total / subtotal) - 1) * 100) : 21;
          const items = Array.isArray(rLines) ? rLines.map((line: any) => ({
            description: line.description || "Item",
            qty: Number(line.amount || 1),
            unit_price: Number(line.price_per_unit || 0) * (1 + (Number(line.vat_percentage || pullVatPct) / 100)),
            total: Number(line.price_with_vat || 0),
          })) : [];

          // Map Rompslomp status to Vakflow status
          const statusMap: Record<string, string> = {
            concept: "concept",
            published: "verzonden",
            approved: "geaccepteerd",
            denied: "afgewezen",
            invoiced: "geaccepteerd",
          };

          // We need a user_id for the quote — use the current user
          await supabaseAdmin.from("quotes").insert({
            customer_id: customer.id,
            company_id: company.id,
            user_id: userId,
            rompslomp_id: rompId,
            quote_number: rQ.invoice_number || null,
            subtotal,
            total,
            vat_amount: vatAmount,
            items,
            optional_items: [],
            status: statusMap[rQ.status] || "concept",
            issued_at: rQ.date || null,
          });
          imported++;
        } catch (err: any) {
          errors.push(`Quotation ${rQuote.id}: ${err.message}`);
        }
      }

      return jsonRes({
        total_in_rompslomp: allQuotations.length,
        already_imported: existingSet.size,
        imported,
        skipped_no_customer: skippedNoCustomer,
        errors,
      });
    }

    // Action: create-invoice (push single invoice to Rompslomp, get back invoice number)
    if (action === "create-invoice") {
      const { invoice_id } = body;
      if (!invoice_id) {
        return jsonRes({ error: "invoice_id is verplicht" }, 400);
      }

      // Fetch invoice with customer
      const { data: inv, error: invErr } = await supabaseAdmin
        .from("invoices")
        .select("*, customers(id, name, rompslomp_contact_id, email, address, postal_code, city, contact_person, phone, type)")
        .eq("id", invoice_id)
        .single();
      if (invErr || !inv) {
        return jsonRes({ error: `Factuur niet gevonden: ${invErr?.message}` }, 400);
      }

      const customer = inv.customers as any;

      // Auto-create contact in Rompslomp if needed
      let contactId = customer?.rompslomp_contact_id;
      if (!contactId && customer) {
        const isIndividual = customer.type === "particulier";
        const contactData: any = {
          is_individual: isIndividual,
          is_supplier: false,
          company_name: !isIndividual ? customer.name : undefined,
          contact_person_name: isIndividual ? customer.name : (customer.contact_person || undefined),
          contact_person_email_address: customer.email || undefined,
          contact_number: customer.phone || undefined,
          address: customer.address || undefined,
          zipcode: customer.postal_code || undefined,
          city: customer.city || undefined,
          api_reference: customer.id,
        };
        const contactResult = await rompslompPost(rompslompCompanyId, "/contacts", apiToken, { contact: contactData });
        contactId = String(contactResult?.id || contactResult?.contact?.id);
        if (contactId) {
          await supabaseAdmin.from("customers").update({ rompslomp_contact_id: contactId }).eq("id", customer.id);
        }
      }

      if (!contactId) {
        return jsonRes({ error: "Kan geen Rompslomp contact aanmaken voor deze klant" }, 400);
      }

      // Build invoice lines
      const vatPct = Number(inv.vat_percentage || 21);
      const items = Array.isArray(inv.items) ? inv.items : [];
      const invoiceLines = (items as any[]).map((item: any) => ({
        description: item.description || "Item",
        quantity: String(item.qty || 1),
        price_per_unit: String(Number(item.unit_price || 0) / (1 + vatPct / 100)),
      }));

      const invoiceData: any = {
        contact_id: parseInt(contactId),
        date: inv.issued_at || new Date().toISOString().split("T")[0],
        due_date: inv.due_at || undefined,
        invoice_lines: invoiceLines,
        api_reference: inv.invoice_number || undefined,
        _publish: true,
      };

      console.log(`create-invoice: pushing to Rompslomp`, JSON.stringify(invoiceData));
      const result = await rompslompPost(rompslompCompanyId, "/sales_invoices", apiToken, { sales_invoice: invoiceData });
      const rompslompId = result?.id || result?.sales_invoice?.id;

      if (!rompslompId) {
        return jsonRes({ error: "Geen ID terug van Rompslomp", result }, 500);
      }

      // Fetch full invoice to get the Rompslomp invoice number
      const { data: fullInvoice } = await rompslompGet(rompslompCompanyId, `/sales_invoices/${rompslompId}`, apiToken);
      const rInv = (fullInvoice as any)?.sales_invoice || fullInvoice;
      const rompslompInvoiceNumber = rInv?.invoice_number || null;

      // Update Vakflow invoice with rompslomp data
      const updateData: any = {
        rompslomp_id: String(rompslompId),
        status: "verzonden",
      };
      if (rompslompInvoiceNumber) {
        updateData.invoice_number = rompslompInvoiceNumber;
      }
      await supabaseAdmin.from("invoices").update(updateData).eq("id", invoice_id);

      console.log(`create-invoice: success, rompslomp_id=${rompslompId}, invoice_number=${rompslompInvoiceNumber}`);
      return jsonRes({
        success: true,
        rompslomp_id: String(rompslompId),
        invoice_number: rompslompInvoiceNumber,
      });
    }

    // Action: create-quote (push single quote to Rompslomp, get back quote number)
    if (action === "create-quote") {
      const { quote_id } = body;
      if (!quote_id) {
        return jsonRes({ error: "quote_id is verplicht" }, 400);
      }

      const { data: quote, error: qErr } = await supabaseAdmin
        .from("quotes")
        .select("*, customers(id, name, rompslomp_contact_id, email, address, postal_code, city, contact_person, phone, type)")
        .eq("id", quote_id)
        .single();
      if (qErr || !quote) {
        return jsonRes({ error: `Offerte niet gevonden: ${qErr?.message}` }, 400);
      }

      const customer = quote.customers as any;

      // Auto-create contact in Rompslomp if needed
      let contactId = customer?.rompslomp_contact_id;
      if (!contactId && customer) {
        const isIndividual = customer.type === "particulier";
        const contactData: any = {
          is_individual: isIndividual,
          is_supplier: false,
          company_name: !isIndividual ? customer.name : undefined,
          contact_person_name: isIndividual ? customer.name : (customer.contact_person || undefined),
          contact_person_email_address: customer.email || undefined,
          contact_number: customer.phone || undefined,
          address: customer.address || undefined,
          zipcode: customer.postal_code || undefined,
          city: customer.city || undefined,
          api_reference: customer.id,
        };
        const contactResult = await rompslompPost(rompslompCompanyId, "/contacts", apiToken, { contact: contactData });
        contactId = String(contactResult?.id || contactResult?.contact?.id);
        if (contactId) {
          await supabaseAdmin.from("customers").update({ rompslomp_contact_id: contactId }).eq("id", customer.id);
        }
      }

      if (!contactId) {
        return jsonRes({ error: "Kan geen Rompslomp contact aanmaken voor deze klant" }, 400);
      }

      const vatPct = Number(quote.vat_percentage || 21);
      const items = Array.isArray(quote.items) ? quote.items : [];
      const quoteLines = (items as any[]).map((item: any) => ({
        description: item.description || "Item",
        quantity: String(item.qty || 1),
        price_per_unit: String(Number(item.unit_price || 0) / (1 + vatPct / 100)),
      }));

      const quotationData: any = {
        contact_id: parseInt(contactId),
        date: quote.issued_at || new Date().toISOString().split("T")[0],
        invoice_lines: quoteLines,
        api_reference: quote.quote_number || undefined,
        _publish: true,
      };

      console.log(`create-quote: pushing to Rompslomp`, JSON.stringify(quotationData));
      const result = await rompslompPost(rompslompCompanyId, "/quotations", apiToken, { quotation: quotationData });
      const rompslompId = result?.id || result?.quotation?.id;

      if (!rompslompId) {
        return jsonRes({ error: "Geen ID terug van Rompslomp", result }, 500);
      }

      // Fetch full quotation to get the Rompslomp quote number
      const fullQuotation = await rompslompGet(rompslompCompanyId, `/quotations/${rompslompId}`, apiToken);
      const rQ = fullQuotation?.quotation || fullQuotation;
      const rompslompQuoteNumber = rQ?.invoice_number || null;

      const updateData: any = {
        rompslomp_id: String(rompslompId),
        status: "verzonden",
      };
      if (rompslompQuoteNumber) {
        updateData.quote_number = rompslompQuoteNumber;
      }
      await supabaseAdmin.from("quotes").update(updateData).eq("id", quote_id);

      console.log(`create-quote: success, rompslomp_id=${rompslompId}, quote_number=${rompslompQuoteNumber}`);
      return jsonRes({
        success: true,
        rompslomp_id: String(rompslompId),
        quote_number: rompslompQuoteNumber,
      });
    }

    // Action: download PDF from Rompslomp
    if (action === "download-pdf") {
      const { rompslomp_id } = body;
      if (!rompslomp_id) {
        return jsonRes({ error: "rompslomp_id is verplicht" }, 400);
      }
      const pdfBytes = await rompslompGetRaw(rompslompCompanyId, `/sales_invoices/${rompslomp_id}/pdf`, apiToken);
      return new Response(pdfBytes, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="Rompslomp_${rompslomp_id}.pdf"`,
        },
      });
    }

    return jsonRes({ error: `Onbekende actie: ${action}` }, 400);
  } catch (err: any) {
    if (err instanceof AuthError) return jsonRes({ error: err.message }, err.status);
    if (err instanceof RateLimitError) return jsonRes({ error: err.message }, 429);
    console.error("sync-rompslomp error:", err.message);
    await logEdgeFunctionError(createAdminClient(), "sync-rompslomp", err.message, { stack: err.stack });
    return jsonRes({ error: err.message }, 500);
  }
});
