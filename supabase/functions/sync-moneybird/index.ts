import { corsHeaders, jsonRes, optionsResponse } from "../_shared/cors.ts";
import { createAdminClient, authenticateRequest, AuthError } from "../_shared/supabase.ts";
import { logEdgeFunctionError } from "../_shared/error-logger.ts";
import { decrypt } from "../_shared/crypto.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";

async function mbGet(adminId: string, path: string, token: string) {
  const url = `${MB_BASE}/${adminId}/${path}.json`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Moneybird GET ${path}: ${res.status} ${errText}`);
  }
  return res.json();
}

async function mbGetRaw(adminId: string, path: string, token: string): Promise<ArrayBuffer> {
  const url = `${MB_BASE}/${adminId}/${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Moneybird GET ${path}: ${res.status} ${errText}`);
  }
  return res.arrayBuffer();
}

async function mbPost(adminId: string, path: string, token: string, body: unknown) {
  const url = `${MB_BASE}/${adminId}/${path}.json`;
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
    throw new Error(`Moneybird POST ${path}: ${res.status} ${errText}`);
  }
  return res.json();
}

async function mbPatch(adminId: string, path: string, token: string, body: unknown) {
  const url = `${MB_BASE}/${adminId}/${path}.json`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Moneybird PATCH ${path}: ${res.status} ${errText}`);
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
    await checkRateLimit(supabaseAdmin, companyId, "sync_moneybird", 5);

    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("id, moneybird_api_token, moneybird_administration_id")
      .eq("id", companyId)
      .single();

    const body = await req.json();
    const { action } = body;

    // Action: auto-detect administrations (token provided in body, not yet saved)
    if (action === "auto-detect") {
      let tokenToUse = body.token;
      if (!tokenToUse && company?.moneybird_api_token) {
        try {
          tokenToUse = company.moneybird_api_token.includes(":")
            ? await decrypt(company.moneybird_api_token)
            : company.moneybird_api_token;
        } catch {
          tokenToUse = company.moneybird_api_token;
        }
      }
      if (!tokenToUse) {
        return jsonRes({ error: "Geen API token opgegeven" }, 400);
      }
      const url = `${MB_BASE}/administrations.json`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${tokenToUse}`, Accept: "application/json" },
      });
      if (!res.ok) {
        const errText = await res.text();
        return jsonRes({ error: `Moneybird API fout: ${res.status} ${errText}` }, 400);
      }
      const administrations = await res.json();
      return jsonRes({
        administrations: Array.isArray(administrations)
          ? administrations.map((a: any) => ({ id: String(a.id), name: a.name || `Administratie ${a.id}` }))
          : [],
      });
    }

    if (!company?.moneybird_api_token || !company?.moneybird_administration_id) {
      return jsonRes({ error: "Moneybird is niet gekoppeld — vul API token en administratie in bij Instellingen > Koppelingen" }, 400);
    }

    // Decrypt stored token (may be encrypted or plaintext for legacy data)
    let apiToken: string;
    try {
      apiToken = company.moneybird_api_token.includes(":")
        ? await decrypt(company.moneybird_api_token)
        : company.moneybird_api_token;
    } catch {
      apiToken = company.moneybird_api_token;
    }
    const adminId = company.moneybird_administration_id;

    // Action: test connection
    if (action === "test") {
      await mbGet(adminId, "contacts?per_page=1", apiToken);
      return jsonRes({ success: true });
    }

    // Action: sync single customer (push to Moneybird)
    if (action === "sync-customer") {
      const { customer_id } = body;
      if (!customer_id) return jsonRes({ error: "customer_id is verplicht" }, 400);

      const { data: cust, error: custErr } = await supabaseAdmin
        .from("customers")
        .select("*")
        .eq("id", customer_id)
        .single();
      if (custErr || !cust) return jsonRes({ error: `Klant niet gevonden: ${custErr?.message}` }, 400);

      if (cust.moneybird_contact_id) {
        return jsonRes({ success: true, skipped: true, message: "Contact bestaat al in Moneybird" });
      }

      const isIndividual = cust.type === "particulier";
      const nameParts = (cust.name || "").split(" ");
      const contactData: any = {
        company_name: !isIndividual ? cust.name : undefined,
        firstname: isIndividual ? nameParts[0] : (cust.contact_person?.split(" ")[0] || undefined),
        lastname: isIndividual ? nameParts.slice(1).join(" ") || cust.name : (cust.contact_person?.split(" ").slice(1).join(" ") || undefined),
        email: cust.email || undefined,
        phone: cust.phone || undefined,
        address1: cust.address || undefined,
        zipcode: cust.postal_code || undefined,
        city: cust.city || undefined,
      };

      const result = await mbPost(adminId, "contacts", apiToken, { contact: contactData });
      const contactId = result?.id;
      if (contactId) {
        await supabaseAdmin.from("customers").update({ moneybird_contact_id: String(contactId) }).eq("id", cust.id);
      }

      return jsonRes({ success: true, moneybird_contact_id: contactId ? String(contactId) : null });
    }

    // Action: sync contacts (push to Moneybird)
    if (action === "sync-contacts") {
      const { data: customers } = await supabaseAdmin
        .from("customers")
        .select("*")
        .eq("company_id", company.id)
        .is("moneybird_contact_id", null);

      let synced = 0;
      const errors: string[] = [];

      for (const cust of customers || []) {
        try {
          const isIndividual = cust.type === "particulier";
          const nameParts = (cust.name || "").split(" ");
          const contactData: any = {
            company_name: !isIndividual ? cust.name : undefined,
            firstname: isIndividual ? nameParts[0] : (cust.contact_person?.split(" ")[0] || undefined),
            lastname: isIndividual ? nameParts.slice(1).join(" ") || cust.name : (cust.contact_person?.split(" ").slice(1).join(" ") || undefined),
            email: cust.email || undefined,
            phone: cust.phone || undefined,
            address1: cust.address || undefined,
            zipcode: cust.postal_code || undefined,
            city: cust.city || undefined,
          };
          const result = await mbPost(adminId, "contacts", apiToken, { contact: contactData });
          const contactId = result?.id;
          if (contactId) {
            await supabaseAdmin.from("customers").update({ moneybird_contact_id: String(contactId) }).eq("id", cust.id);
            synced++;
          }
        } catch (err: any) {
          errors.push(`${cust.name}: ${err.message}`);
        }
      }

      return jsonRes({ synced, skipped: 0, errors });
    }

    // Action: pull contacts (from Moneybird)
    if (action === "pull-contacts") {
      let page = 1;
      let allContacts: any[] = [];
      while (true) {
        const contacts = await mbGet(adminId, `contacts?page=${page}&per_page=100`, apiToken);
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
          const name = contact.company_name || [contact.firstname, contact.lastname].filter(Boolean).join(" ") || `Contact ${contactId}`;
          const customerData: any = {
            name,
            contact_person: [contact.firstname, contact.lastname].filter(Boolean).join(" ") || null,
            email: contact.email || null,
            phone: contact.phone || null,
            address: contact.address1 || null,
            postal_code: contact.zipcode || null,
            city: contact.city || null,
            moneybird_contact_id: contactId,
          };

          const { data: existing } = await supabaseAdmin
            .from("customers")
            .select("id")
            .eq("moneybird_contact_id", contactId)
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

    // Action: sync invoices (push to Moneybird)
    if (action === "sync-invoices") {
      const { data: invoices } = await supabaseAdmin
        .from("invoices")
        .select("*, customers(id, name, moneybird_contact_id)")
        .eq("company_id", company.id)
        .is("moneybird_id", null);

      let synced = 0, skipped = 0;
      const errors: string[] = [];

      for (const inv of invoices || []) {
        try {
          const customer = inv.customers as any;
          if (!customer?.moneybird_contact_id) { skipped++; continue; }

          const vatPct = Number(inv.vat_percentage || 21);
          const items = Array.isArray(inv.items) ? inv.items : [];
          const details = (items as any[]).map((item: any) => ({
            description: item.description || "Item",
            amount: String(item.qty || 1),
            price: String(Number(item.unit_price || 0) / (1 + vatPct / 100)),
          }));

          const invoiceData: any = {
            contact_id: parseInt(customer.moneybird_contact_id),
            invoice_date: inv.issued_at || new Date().toISOString().split("T")[0],
            due_date: inv.due_at || undefined,
            details_attributes: details,
          };

          const result = await mbPost(adminId, "sales_invoices", apiToken, { sales_invoice: invoiceData });
          const mbId = result?.id;
          if (mbId) {
            // Send/publish the invoice
            await mbPatch(adminId, `sales_invoices/${mbId}/send_invoice`, apiToken, { sales_invoice_sending: { delivery_method: "Manual" } });
            await supabaseAdmin.from("invoices").update({ moneybird_id: String(mbId) }).eq("id", inv.id);
            synced++;
          }
        } catch (err: any) {
          errors.push(`${inv.invoice_number || inv.id}: ${err.message}`);
        }
      }

      return jsonRes({ synced, skipped, errors });
    }

    // Action: pull invoices (from Moneybird)
    if (action === "pull-invoices") {
      let page = 1;
      let allInvoices: any[] = [];
      while (true) {
        const invoices = await mbGet(adminId, `sales_invoices?page=${page}&per_page=100`, apiToken);
        if (!Array.isArray(invoices) || invoices.length === 0) break;
        allInvoices = allInvoices.concat(invoices);
        if (invoices.length < 100) break;
        page++;
      }

      const { data: existingInvoices } = await supabaseAdmin
        .from("invoices")
        .select("id, moneybird_id")
        .eq("company_id", company.id)
        .not("moneybird_id", "is", null);

      const existingSet = new Set((existingInvoices || []).map(i => String(i.moneybird_id)));

      let imported = 0, skippedNoCustomer = 0;
      const errors: string[] = [];

      for (const mInv of allInvoices) {
        try {
          const mbId = String(mInv.id);
          if (existingSet.has(mbId)) continue;

          const contactId = mInv.contact_id ? String(mInv.contact_id) : null;
          let customer = null;
          if (contactId) {
            const { data } = await supabaseAdmin
              .from("customers")
              .select("id")
              .eq("moneybird_contact_id", contactId)
              .eq("company_id", company.id)
              .maybeSingle();
            customer = data;
          }

          if (!customer) { skippedNoCustomer++; continue; }

          const totalPrice = Number(mInv.total_price_incl_tax || 0);
          const totalExcl = Number(mInv.total_price_excl_tax || 0);
          const vatAmount = totalPrice - totalExcl;

          const details = mInv.details || [];
          const items = Array.isArray(details) ? details.map((d: any) => ({
            description: d.description || "Item",
            qty: Number(d.amount || d.amount_decimal || 1),
            unit_price: Number(d.price || 0) * (1 + (Number(d.tax_rate?.percentage || 21) / 100)),
            total: Number(d.total_price_excl_tax_with_discount || 0) * (1 + (Number(d.tax_rate?.percentage || 21) / 100)),
          })) : [];

          const state = mInv.state;
          const isPaid = state === "paid";

          await supabaseAdmin.from("invoices").insert({
            customer_id: customer.id,
            company_id: company.id,
            moneybird_id: mbId,
            invoice_number: mInv.invoice_id || null,
            subtotal: totalExcl,
            total: totalPrice,
            vat_amount: vatAmount,
            items,
            status: isPaid ? "betaald" : (state === "open" || state === "late" || state === "reminded" ? "verzonden" : "concept"),
            issued_at: mInv.invoice_date || null,
            paid_at: isPaid ? new Date().toISOString().split("T")[0] : null,
          });
          imported++;
        } catch (err: any) {
          errors.push(`Invoice ${mInv.id}: ${err.message}`);
        }
      }

      return jsonRes({
        total_in_moneybird: allInvoices.length,
        already_imported: existingSet.size,
        imported,
        skipped_no_customer: skippedNoCustomer,
        errors,
      });
    }

    // Action: pull invoice status
    if (action === "pull-invoice-status") {
      const { data: unpaid } = await supabaseAdmin
        .from("invoices")
        .select("id, moneybird_id")
        .eq("company_id", company.id)
        .not("moneybird_id", "is", null)
        .neq("status", "betaald");

      let checked = 0, updated = 0;
      const errors: string[] = [];

      for (const inv of unpaid || []) {
        try {
          const mInv = await mbGet(adminId, `sales_invoices/${inv.moneybird_id}`, apiToken);
          checked++;
          if (mInv.state === "paid") {
            await supabaseAdmin
              .from("invoices")
              .update({ status: "betaald", paid_at: new Date().toISOString().split("T")[0] })
              .eq("id", inv.id);
            updated++;
          }
        } catch (err: any) {
          errors.push(`Invoice ${inv.moneybird_id}: ${err.message}`);
        }
      }

      return jsonRes({ checked, updated, errors });
    }

    // Action: create-invoice (push single invoice, get back invoice number)
    if (action === "create-invoice") {
      const { invoice_id } = body;
      if (!invoice_id) {
        return jsonRes({ error: "invoice_id is verplicht" }, 400);
      }

      const { data: inv, error: invErr } = await supabaseAdmin
        .from("invoices")
        .select("*, customers(id, name, moneybird_contact_id, email, address, postal_code, city, contact_person, phone, type)")
        .eq("id", invoice_id)
        .single();
      if (invErr || !inv) {
        return jsonRes({ error: `Factuur niet gevonden: ${invErr?.message}` }, 400);
      }

      const customer = inv.customers as any;

      // Auto-create contact in Moneybird if needed
      let contactId = customer?.moneybird_contact_id;
      if (!contactId && customer) {
        const isIndividual = customer.type === "particulier";
        const nameParts = (customer.name || "").split(" ");
        const contactData: any = {
          company_name: !isIndividual ? customer.name : undefined,
          firstname: isIndividual ? nameParts[0] : (customer.contact_person?.split(" ")[0] || undefined),
          lastname: isIndividual ? nameParts.slice(1).join(" ") || customer.name : (customer.contact_person?.split(" ").slice(1).join(" ") || undefined),
          email: customer.email || undefined,
          phone: customer.phone || undefined,
          address1: customer.address || undefined,
          zipcode: customer.postal_code || undefined,
          city: customer.city || undefined,
        };
        const contactResult = await mbPost(adminId, "contacts", apiToken, { contact: contactData });
        contactId = String(contactResult?.id);
        if (contactId) {
          await supabaseAdmin.from("customers").update({ moneybird_contact_id: contactId }).eq("id", customer.id);
        }
      }

      if (!contactId) {
        return jsonRes({ error: "Kan geen Moneybird contact aanmaken voor deze klant" }, 400);
      }

      const vatPct = Number(inv.vat_percentage || 21);
      const items = Array.isArray(inv.items) ? inv.items : [];
      const details = (items as any[]).map((item: any) => ({
        description: item.description || "Item",
        amount: String(item.qty || 1),
        price: String(Number(item.unit_price || 0) / (1 + vatPct / 100)),
      }));

      const invoiceData: any = {
        contact_id: parseInt(contactId),
        invoice_date: inv.issued_at || new Date().toISOString().split("T")[0],
        due_date: inv.due_at || undefined,
        details_attributes: details,
      };

      console.log(`create-invoice: pushing to Moneybird`, JSON.stringify(invoiceData));
      const result = await mbPost(adminId, "sales_invoices", apiToken, { sales_invoice: invoiceData });
      const mbId = result?.id;

      if (!mbId) {
        return jsonRes({ error: "Geen ID terug van Moneybird", result }, 500);
      }

      // Send/publish the invoice
      await mbPatch(adminId, `sales_invoices/${mbId}/send_invoice`, apiToken, { sales_invoice_sending: { delivery_method: "Manual" } });

      // Fetch full invoice to get invoice_id (= Moneybird invoice number)
      const fullInvoice = await mbGet(adminId, `sales_invoices/${mbId}`, apiToken);
      const moneybirdInvoiceNumber = fullInvoice?.invoice_id || null;

      const updateData: any = {
        moneybird_id: String(mbId),
        status: "verzonden",
      };
      if (moneybirdInvoiceNumber) {
        updateData.invoice_number = moneybirdInvoiceNumber;
      }
      await supabaseAdmin.from("invoices").update(updateData).eq("id", invoice_id);

      console.log(`create-invoice: success, moneybird_id=${mbId}, invoice_number=${moneybirdInvoiceNumber}`);
      return jsonRes({
        success: true,
        moneybird_id: String(mbId),
        invoice_number: moneybirdInvoiceNumber,
      });
    }

    // Action: download PDF
    if (action === "download-pdf") {
      const { moneybird_id } = body;
      if (!moneybird_id) {
        return jsonRes({ error: "moneybird_id is verplicht" }, 400);
      }
      const pdfBytes = await mbGetRaw(adminId, `sales_invoices/${moneybird_id}/download_pdf`, apiToken);
      return new Response(pdfBytes, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="Moneybird_${moneybird_id}.pdf"`,
        },
      });
    }

    // Action: create single quote (push to Moneybird as estimate, adopt estimate number)
    if (action === "create-quote") {
      const { quote_id } = body;
      if (!quote_id) {
        return jsonRes({ error: "quote_id is verplicht" }, 400);
      }

      const { data: quote, error: qErr } = await supabaseAdmin
        .from("quotes")
        .select("*, customers(id, name, type, contact_person, email, phone, address, postal_code, city, moneybird_contact_id)")
        .eq("id", quote_id)
        .single();
      if (qErr || !quote) {
        return jsonRes({ error: `Offerte niet gevonden: ${qErr?.message}` }, 400);
      }

      const customer = quote.customers as any;

      // Auto-create contact in Moneybird if needed
      let contactId = customer?.moneybird_contact_id;
      if (!contactId && customer) {
        const isIndividual = customer.type === "particulier";
        const nameParts = (customer.name || "").split(" ");
        const contactData: any = {
          company_name: !isIndividual ? customer.name : undefined,
          firstname: isIndividual ? nameParts[0] : (customer.contact_person?.split(" ")[0] || undefined),
          lastname: isIndividual ? nameParts.slice(1).join(" ") || customer.name : (customer.contact_person?.split(" ").slice(1).join(" ") || undefined),
          email: customer.email || undefined,
          phone: customer.phone || undefined,
          address1: customer.address || undefined,
          zipcode: customer.postal_code || undefined,
          city: customer.city || undefined,
        };
        const contactResult = await mbPost(adminId, "contacts", apiToken, { contact: contactData });
        contactId = String(contactResult?.id);
        if (contactId) {
          await supabaseAdmin.from("customers").update({ moneybird_contact_id: contactId }).eq("id", customer.id);
        }
      }

      if (!contactId) {
        return jsonRes({ error: "Kan geen Moneybird contact aanmaken voor deze klant" }, 400);
      }

      const vatPct = Number(quote.vat_percentage || 21);
      const items = Array.isArray(quote.items) ? quote.items : [];
      const details = (items as any[]).map((item: any) => ({
        description: item.description || "Item",
        amount: String(item.qty || 1),
        price: String(Number(item.unit_price || 0) / (1 + vatPct / 100)),
      }));

      const estimateData: any = {
        contact_id: parseInt(contactId),
        estimate_date: quote.issued_at || new Date().toISOString().split("T")[0],
        details_attributes: details,
      };

      console.log(`create-quote: pushing to Moneybird`, JSON.stringify(estimateData));
      const result = await mbPost(adminId, "estimates", apiToken, { estimate: estimateData });
      const mbId = result?.id;

      if (!mbId) {
        return jsonRes({ error: "Geen ID terug van Moneybird", result }, 500);
      }

      // Fetch full estimate to get estimate_id (= Moneybird estimate number)
      const fullEstimate = await mbGet(adminId, `estimates/${mbId}`, apiToken);
      const moneybirdEstimateNumber = fullEstimate?.estimate_id || null;

      const updateData: any = {
        moneybird_id: String(mbId),
        status: "verzonden",
      };
      if (moneybirdEstimateNumber) {
        updateData.quote_number = moneybirdEstimateNumber;
      }
      await supabaseAdmin.from("quotes").update(updateData).eq("id", quote_id);

      console.log(`create-quote: success, moneybird_id=${mbId}, quote_number=${moneybirdEstimateNumber}`);
      return jsonRes({
        success: true,
        moneybird_id: String(mbId),
        quote_number: moneybirdEstimateNumber,
      });
    }

    // Action: sync quotes (push to Moneybird as estimates)
    if (action === "sync-quotes") {
      const { data: quotes } = await supabaseAdmin
        .from("quotes")
        .select("*, customers(id, name, moneybird_contact_id)")
        .eq("company_id", company.id)
        .is("moneybird_id", null);

      let synced = 0, skipped = 0;
      const errors: string[] = [];

      for (const quote of quotes || []) {
        try {
          const customer = quote.customers as any;
          if (!customer?.moneybird_contact_id) { skipped++; continue; }

          const vatPct = Number(quote.vat_percentage || 21);
          const items = Array.isArray(quote.items) ? quote.items : [];
          const details = (items as any[]).map((item: any) => ({
            description: item.description || "Item",
            amount: String(item.qty || 1),
            price: String(Number(item.unit_price || 0) / (1 + vatPct / 100)),
          }));

          const estimateData: any = {
            contact_id: parseInt(customer.moneybird_contact_id),
            estimate_date: quote.issued_at || new Date().toISOString().split("T")[0],
            details_attributes: details,
          };

          const result = await mbPost(adminId, "estimates", apiToken, { estimate: estimateData });
          const mbId = result?.id;
          if (mbId) {
            await supabaseAdmin.from("quotes").update({ moneybird_id: String(mbId) }).eq("id", quote.id);
            synced++;
          }
        } catch (err: any) {
          errors.push(`${quote.quote_number || quote.id}: ${err.message}`);
        }
      }

      return jsonRes({ synced, skipped, errors });
    }

    // Action: pull quotes (from Moneybird estimates)
    if (action === "pull-quotes") {
      let page = 1;
      let allEstimates: any[] = [];
      while (true) {
        const estimates = await mbGet(adminId, `estimates?page=${page}&per_page=100`, apiToken);
        if (!Array.isArray(estimates) || estimates.length === 0) break;
        allEstimates = allEstimates.concat(estimates);
        if (estimates.length < 100) break;
        page++;
      }

      const { data: existingQuotes } = await supabaseAdmin
        .from("quotes")
        .select("id, moneybird_id")
        .eq("company_id", company.id)
        .not("moneybird_id", "is", null);

      const existingSet = new Set((existingQuotes || []).map(q => String(q.moneybird_id)));

      let imported = 0, skippedNoCustomer = 0;
      const errors: string[] = [];

      for (const est of allEstimates) {
        try {
          const mbId = String(est.id);
          if (existingSet.has(mbId)) continue;

          const contactId = est.contact_id ? String(est.contact_id) : null;
          let customer = null;
          if (contactId) {
            const { data } = await supabaseAdmin
              .from("customers")
              .select("id")
              .eq("moneybird_contact_id", contactId)
              .eq("company_id", company.id)
              .maybeSingle();
            customer = data;
          }

          if (!customer) { skippedNoCustomer++; continue; }

          const totalPrice = Number(est.total_price_incl_tax || 0);
          const totalExcl = Number(est.total_price_excl_tax || 0);
          const vatAmount = totalPrice - totalExcl;
          const vatPct = totalExcl > 0 ? ((totalPrice - totalExcl) / totalExcl) * 100 : 21;

          const details = est.details || [];
          const items = Array.isArray(details) ? details.map((d: any) => ({
            description: d.description || "Item",
            qty: Number(d.amount || d.amount_decimal || 1),
            unit_price: Number(d.price || 0) * (1 + vatPct / 100),
            total: Number(d.total_price_excl_tax_with_discount || 0) * (1 + vatPct / 100),
          })) : [];

          const stateMap: Record<string, string> = {
            draft: "concept",
            open: "verzonden",
            late: "verzonden",
            accepted: "geaccepteerd",
            rejected: "afgewezen",
            billed: "geaccepteerd",
          };

          await supabaseAdmin.from("quotes").insert({
            customer_id: customer.id,
            company_id: company.id,
            user_id: userId,
            moneybird_id: mbId,
            quote_number: est.estimate_id || null,
            subtotal: totalExcl,
            total: totalPrice,
            vat_amount: vatAmount,
            items,
            optional_items: [],
            status: stateMap[est.state] || "concept",
            issued_at: est.estimate_date || null,
          });
          imported++;
        } catch (err: any) {
          errors.push(`Estimate ${est.id}: ${err.message}`);
        }
      }

      return jsonRes({
        total_in_moneybird: allEstimates.length,
        already_imported: existingSet.size,
        imported,
        skipped_no_customer: skippedNoCustomer,
        errors,
      });
    }

    return jsonRes({ error: `Onbekende actie: ${action}` }, 400);
  } catch (err: any) {
    if (err instanceof AuthError) return jsonRes({ error: err.message }, err.status);
    if (err instanceof RateLimitError) return jsonRes({ error: err.message }, 429);
    console.error("sync-moneybird error:", err.message);
    await logEdgeFunctionError(createAdminClient(), "sync-moneybird", err.message, { stack: err.stack });
    return jsonRes({ error: err.message }, 500);
  }
});
