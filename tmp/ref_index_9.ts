import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MONEYBIRD_API_BASE = "https://moneybird.com/api/v2";

// Branded HTML email template for invoices and reminders
function buildInvoiceEmailHtml(params: {
  type: "invoice" | "reminder";
  contactName: string;
  invoiceNumber: string;
  totalAmount: string;
  paymentUrl: string;
}): string {
  const { type, contactName, invoiceNumber, totalAmount, paymentUrl } = params;
  const isReminder = type === "reminder";
  const greeting = contactName ? `Beste ${contactName}` : "Beste";
  const formattedAmount = `€${parseFloat(totalAmount).toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const introText = isReminder
    ? `Wij willen je er vriendelijk aan herinneren dat factuur <strong>${invoiceNumber}</strong> ter waarde van <strong>${formattedAmount}</strong> nog openstaat.`
    : `Hierbij ontvang je factuur <strong>${invoiceNumber}</strong> ter waarde van <strong>${formattedAmount}</strong>.`;

  const paymentButton = paymentUrl
    ? `<tr><td align="center" style="padding: 24px 0;">
        <a href="${paymentUrl}" style="display:inline-block;background:#ED7009;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;">
          ${isReminder ? "Nu betalen" : "Betaal factuur"}
        </a>
      </td></tr>`
    : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:16px;overflow:hidden;border:1px solid #2a2a2a;">
  <tr><td style="padding:32px 40px 24px;text-align:center;border-bottom:1px solid #2a2a2a;">
    <img src="https://streetgasm.lovable.app/assets/streetgasm-logo.svg" alt="Streetgasm" width="180" style="display:inline-block;" />
  </td></tr>
  <tr><td style="padding:32px 40px;color:#e0e0e0;font-size:15px;line-height:1.6;">
    <p style="margin:0 0 16px;">${greeting},</p>
    <p style="margin:0 0 16px;">${introText}</p>
    <p style="margin:0 0 8px;">De factuur is als PDF bijgevoegd bij deze e-mail.</p>
  </td></tr>
  ${paymentButton}
  <tr><td style="padding:24px 40px 32px;color:#888;font-size:12px;text-align:center;border-top:1px solid #2a2a2a;">
    Streetgasm &mdash; Exclusieve automotive community<br/>
    <a href="https://streetgasm.com" style="color:#ED7009;text-decoration:none;">streetgasm.com</a>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

async function getMoneybirdCredentials(supabase: any, encryptionKey: string) {
  const { data: mbTokenData } = await supabase.rpc("decrypt_setting", {
    p_key: "MONEYBIRD_API_TOKEN",
    p_passphrase: encryptionKey,
  });
  const { data: mbAdminIdData } = await supabase.rpc("decrypt_setting", {
    p_key: "MONEYBIRD_ADMINISTRATION_ID",
    p_passphrase: encryptionKey,
  });
  const mbToken = mbTokenData || Deno.env.get("MONEYBIRD_API_TOKEN");
  const mbAdminId = mbAdminIdData || Deno.env.get("MONEYBIRD_ADMINISTRATION_ID");
  return { mbToken, mbAdminId };
}

// Helper: find or create Moneybird contact using contact_info (for signups without WC customer)
async function findOrCreateContactFromInfo(
  contactInfo: any,
  mbHeaders: Record<string, string>,
  mbAdminId: string,
  supabase: any,
  wcCustomerId?: number | null,
) {
  let contactId: string | null = null;

  // Try by email first
  if (contactInfo.email) {
    try {
      const searchRes = await fetch(
        `${MONEYBIRD_API_BASE}/${mbAdminId}/contacts.json?query=${encodeURIComponent(contactInfo.email)}`,
        { headers: mbHeaders }
      );
      const searchData = await searchRes.json();
      if (Array.isArray(searchData) && searchData.length > 0) {
        contactId = searchData[0].id;
      }
    } catch (e) {
      console.warn("[MB-INVOICE] Email search failed:", e);
    }
  }

  if (!contactId) {
    const createRes = await fetch(`${MONEYBIRD_API_BASE}/${mbAdminId}/contacts.json`, {
      method: "POST",
      headers: mbHeaders,
      body: JSON.stringify({
        contact: {
          firstname: contactInfo.first_name || "",
          lastname: contactInfo.last_name || "",
          company_name: contactInfo.company || "",
          email: contactInfo.email || "",
          phone: contactInfo.phone || "",
          address1: contactInfo.address_1 || "",
          zipcode: contactInfo.postcode || "",
          city: contactInfo.city || "",
          country: contactInfo.country || "NL",
          customer_id: wcCustomerId ? String(wcCustomerId) : undefined,
        },
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      throw new Error(`Moneybird contact creation failed [${createRes.status}]: ${err}`);
    }

    const newContact = await createRes.json();
    contactId = newContact.id;
  }

  return contactId;
}

// Helper: find or create Moneybird contact from WC customer data
async function findOrCreateContactFromWC(
  customer: any,
  wc_customer_id: number,
  mbHeaders: Record<string, string>,
  mbAdminId: string,
  supabase: any,
) {
  const billing = (customer.billing || {}) as Record<string, string>;
  const existingMb = (customer.moneybird || {}) as Record<string, string>;
  let contactId = existingMb.contact_id;

  if (!contactId) {
    // Try exact match by customer_id
    try {
      const custLookup = await fetch(
        `${MONEYBIRD_API_BASE}/${mbAdminId}/contacts/customer_id/${wc_customer_id}.json`,
        { headers: mbHeaders }
      );
      if (custLookup.ok) {
        const found = await custLookup.json();
        contactId = found.id;
      } else {
        await custLookup.text();
      }
    } catch (e) {
      console.warn("[MB-INVOICE] customer_id lookup failed, trying email:", e);
    }

    // Fallback: search by email
    if (!contactId) {
      const searchRes = await fetch(
        `${MONEYBIRD_API_BASE}/${mbAdminId}/contacts.json?query=${encodeURIComponent(customer.email || "")}`,
        { headers: mbHeaders }
      );
      const searchData = await searchRes.json();
      if (Array.isArray(searchData) && searchData.length > 0) {
        contactId = searchData[0].id;
      }
    }

    if (!contactId) {
      const createRes = await fetch(`${MONEYBIRD_API_BASE}/${mbAdminId}/contacts.json`, {
        method: "POST",
        headers: mbHeaders,
        body: JSON.stringify({
          contact: {
            firstname: billing.first_name || customer.first_name || "",
            lastname: billing.last_name || customer.last_name || "",
            company_name: (customer.bedrijf as any)?.naam || "",
            email: customer.email || "",
            phone: billing.phone || "",
            address1: billing.address_1 || "",
            zipcode: billing.postcode || "",
            city: billing.city || "",
            country: billing.country || "NL",
            customer_id: String(wc_customer_id),
          },
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.text();
        throw new Error(`Moneybird contact creation failed [${createRes.status}]: ${err}`);
      }

      const newContact = await createRes.json();
      contactId = newContact.id;
    }

    // Save contact_id to wc_customers.moneybird
    await supabase
      .from("wc_customers")
      .update({ moneybird: { ...existingMb, contact_id: contactId } })
      .eq("id", Number(wc_customer_id));
  }

  return contactId;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let body: any = {};
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = authHeader.replace("Bearer ", "");
    if (token !== serviceKey) {
      const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
      const { data: { user }, error: authError } = await anonClient.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const encryptionKey = serviceKey.substring(0, 32);

    const { mbToken, mbAdminId } = await getMoneybirdCredentials(supabase, encryptionKey);

    if (!mbToken || !mbAdminId) {
      return new Response(
        JSON.stringify({
          error: "Moneybird is nog niet geconfigureerd. Vul de API keys in via Instellingen.",
          missing_keys: true,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Check EMAIL_SEND_MODE (test mode) ──
    let emailSendMode = "test"; // default: safe
    try {
      const { data: modeData } = await supabase.rpc("decrypt_setting", {
        p_key: "EMAIL_SEND_MODE",
        p_passphrase: encryptionKey,
      });
      if (modeData) emailSendMode = modeData;
    } catch { /* default to test */ }

    body = await req.json();
    const { action, wc_customer_id, amount, description, product_id, moneybird_invoice_id, contact_id, contact_data, contact_info, signup_id } = body;

    if (!action) {
      return new Response(JSON.stringify({ error: "Missing action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Request logging ──
    console.log(`[MB] Action: ${action}, wc_customer_id: ${wc_customer_id || '-'}, signup_id: ${signup_id || '-'}, contact_id: ${contact_id || '-'}`);

    const mbHeaders = {
      Authorization: `Bearer ${mbToken}`,
      "Content-Type": "application/json",
    };

    // ── Action: list_ledger_accounts ──
    if (action === "list_ledger_accounts") {
      const res = await fetch(`${MONEYBIRD_API_BASE}/${mbAdminId}/ledger_accounts.json`, { headers: mbHeaders });
      if (!res.ok) throw new Error(`List ledger accounts failed [${res.status}]: ${await res.text()}`);
      const ledger_accounts = await res.json();
      return new Response(JSON.stringify({ success: true, ledger_accounts }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: list_tax_rates ──
    if (action === "list_tax_rates") {
      const res = await fetch(`${MONEYBIRD_API_BASE}/${mbAdminId}/tax_rates.json`, { headers: mbHeaders });
      if (!res.ok) throw new Error(`List tax rates failed [${res.status}]: ${await res.text()}`);
      const tax_rates = await res.json();
      return new Response(JSON.stringify({ success: true, tax_rates }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: list_products ──
    if (action === "list_products") {
      const query = body.query || "";
      const page = body.page || 1;
      const perPage = body.per_page || 100;
      let url = `${MONEYBIRD_API_BASE}/${mbAdminId}/products.json?page=${page}&per_page=${perPage}`;
      if (query) url += `&query=${encodeURIComponent(query)}`;
      const res = await fetch(url, { headers: mbHeaders });
      if (!res.ok) throw new Error(`List products failed [${res.status}]: ${await res.text()}`);
      const products = await res.json();
      return new Response(JSON.stringify({ success: true, products }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: create_product ──
    if (action === "create_product") {
      const productPayload: Record<string, unknown> = {};
      if (body.product_description) productPayload.description = body.product_description;
      if (body.product_title) productPayload.title = body.product_title;
      if (body.product_price) productPayload.price = body.product_price;
      if (body.product_identifier) productPayload.identifier = body.product_identifier;
      if (body.product_frequency) productPayload.frequency = body.product_frequency;
      if (body.product_frequency_type) productPayload.frequency_type = body.product_frequency_type;
      if (body.tax_rate_id) productPayload.tax_rate_id = body.tax_rate_id;
      if (body.ledger_account_id) productPayload.ledger_account_id = body.ledger_account_id;

      console.log(`[MB] Creating product:`, JSON.stringify(productPayload));
      const res = await fetch(`${MONEYBIRD_API_BASE}/${mbAdminId}/products.json`, {
        method: "POST",
        headers: mbHeaders,
        body: JSON.stringify({ product: productPayload }),
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error(`[MB] Create product failed [${res.status}]:`, errText);
        throw new Error(`Create product failed [${res.status}]: ${errText}`);
      }
      const product = await res.json();

      await supabase.from("activity_log").insert({
        action: "moneybird_product_created",
        entity_type: "moneybird_product",
        entity_id: product.id,
        details: { description: productPayload.description, identifier: productPayload.identifier },
      });

      return new Response(JSON.stringify({ success: true, product }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: update_product ──
    if (action === "update_product") {
      const mbProductId = body.mb_product_id;
      if (!mbProductId) {
        return new Response(JSON.stringify({ error: "Missing mb_product_id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const productPayload: Record<string, unknown> = {};
      if (body.product_description !== undefined) productPayload.description = body.product_description;
      if (body.product_title !== undefined) productPayload.title = body.product_title;
      if (body.product_price !== undefined) productPayload.price = body.product_price;
      if (body.product_identifier !== undefined) productPayload.identifier = body.product_identifier;
      if (body.product_frequency !== undefined) productPayload.frequency = body.product_frequency;
      if (body.product_frequency_type !== undefined) productPayload.frequency_type = body.product_frequency_type;

      const res = await fetch(`${MONEYBIRD_API_BASE}/${mbAdminId}/products/${mbProductId}.json`, {
        method: "PATCH",
        headers: mbHeaders,
        body: JSON.stringify({ product: productPayload }),
      });
      if (!res.ok) throw new Error(`Update product failed [${res.status}]: ${await res.text()}`);
      const product = await res.json();

      await supabase.from("activity_log").insert({
        action: "moneybird_product_updated",
        entity_type: "moneybird_product",
        entity_id: product.id,
        details: { fields_updated: Object.keys(productPayload) },
      });

      return new Response(JSON.stringify({ success: true, product }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: list_contacts ──
    if (action === "list_contacts") {
      const query = body.query || "";
      const page = body.page || 1;
      const perPage = body.per_page || 50;
      const url = query
        ? `${MONEYBIRD_API_BASE}/${mbAdminId}/contacts.json?query=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}`
        : `${MONEYBIRD_API_BASE}/${mbAdminId}/contacts.json?page=${page}&per_page=${perPage}`;
      const res = await fetch(url, { headers: mbHeaders });
      if (!res.ok) throw new Error(`List contacts failed [${res.status}]: ${await res.text()}`);
      const contacts = await res.json();
      return new Response(JSON.stringify({ success: true, contacts }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: get_contact ──
    if (action === "get_contact") {
      if (!contact_id) {
        return new Response(JSON.stringify({ error: "Missing contact_id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const res = await fetch(`${MONEYBIRD_API_BASE}/${mbAdminId}/contacts/${contact_id}.json`, { headers: mbHeaders });
      if (!res.ok) throw new Error(`Get contact failed [${res.status}]: ${await res.text()}`);
      const contact = await res.json();
      return new Response(JSON.stringify({ success: true, contact }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: create_contact ──
    if (action === "create_contact") {
      if (!contact_data) {
        return new Response(JSON.stringify({ error: "Missing contact_data" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const res = await fetch(`${MONEYBIRD_API_BASE}/${mbAdminId}/contacts.json`, {
        method: "POST",
        headers: mbHeaders,
        body: JSON.stringify({ contact: contact_data }),
      });
      if (!res.ok) throw new Error(`Create contact failed [${res.status}]: ${await res.text()}`);
      const contact = await res.json();
      return new Response(JSON.stringify({ success: true, contact }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: list_invoices ──
    if (action === "list_invoices") {
      const state = body.state || "all";
      const page = body.page || 1;
      const perPage = body.per_page || 50;
      let url: string;
      if (state === "all") {
        url = `${MONEYBIRD_API_BASE}/${mbAdminId}/sales_invoices.json?page=${page}&per_page=${perPage}`;
      } else {
        url = `${MONEYBIRD_API_BASE}/${mbAdminId}/sales_invoices.json?filter=state:${state}&page=${page}&per_page=${perPage}`;
      }
      const res = await fetch(url, { headers: mbHeaders });
      if (!res.ok) throw new Error(`List invoices failed [${res.status}]: ${await res.text()}`);
      const invoices = await res.json();
      return new Response(JSON.stringify({ success: true, invoices }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: get_invoice ──
    if (action === "get_invoice") {
      if (!moneybird_invoice_id) {
        return new Response(JSON.stringify({ error: "Missing moneybird_invoice_id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const res = await fetch(`${MONEYBIRD_API_BASE}/${mbAdminId}/sales_invoices/${moneybird_invoice_id}.json`, { headers: mbHeaders });
      if (!res.ok) throw new Error(`Get invoice failed [${res.status}]: ${await res.text()}`);
      const invoice = await res.json();
      return new Response(JSON.stringify({ success: true, invoice }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: send_invoice ──
    if (action === "send_invoice") {
      if (!moneybird_invoice_id) {
        return new Response(JSON.stringify({ error: "Missing moneybird_invoice_id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Step 1: Always set invoice to "open" in Moneybird via Manual delivery
      const sendInvoiceRes = await fetch(
        `${MONEYBIRD_API_BASE}/${mbAdminId}/sales_invoices/${moneybird_invoice_id}/send_invoice.json`,
        {
          method: "PATCH",
          headers: mbHeaders,
          body: JSON.stringify({ sales_invoice_sending: { delivery_method: "Manual" } }),
        }
      );
      if (!sendInvoiceRes.ok) {
        const err = await sendInvoiceRes.text();
        console.error(`[MB-INVOICE] send_invoice (Manual) failed [${sendInvoiceRes.status}]:`, err);
        throw new Error(`Moneybird send_invoice failed [${sendInvoiceRes.status}]: ${err}`);
      }
      await sendInvoiceRes.text(); // consume body
      console.log(`[MB-INVOICE] Factuur ${moneybird_invoice_id} op "open" gezet via Manual delivery`);

      // Step 2: In test mode, skip Outlook email but invoice is already "open"
      if (emailSendMode === "test") {
        console.log(`[MB-INVOICE] TESTMODUS: Outlook e-mail geblokkeerd voor ${moneybird_invoice_id}, factuur staat wel op open`);

        await supabase
          .from("moneybird_invoices")
          .update({ status: "open" })
          .eq("moneybird_invoice_id", moneybird_invoice_id);

        return new Response(JSON.stringify({
          success: true,
          blocked_email: true,
          message: "Factuur op open gezet in Moneybird, e-mail niet verstuurd (testmodus)",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Step 3: Production mode — also send via Outlook with PDF
      // 3a. Fetch invoice details from Moneybird
      const invRes = await fetch(`${MONEYBIRD_API_BASE}/${mbAdminId}/sales_invoices/${moneybird_invoice_id}.json`, { headers: mbHeaders });
      if (!invRes.ok) throw new Error(`Fetch invoice failed [${invRes.status}]: ${await invRes.text()}`);
      const invoice = await invRes.json();

      // 3b. Get contact email
      const contactRes = await fetch(`${MONEYBIRD_API_BASE}/${mbAdminId}/contacts/${invoice.contact_id}.json`, { headers: mbHeaders });
      if (!contactRes.ok) throw new Error(`Fetch contact failed [${contactRes.status}]: ${await contactRes.text()}`);
      const contact = await contactRes.json();
      const recipientEmail = contact.email;
      if (!recipientEmail) throw new Error("Contact heeft geen e-mailadres in Moneybird");

      // 3c. Download PDF
      const pdfRes = await fetch(`${MONEYBIRD_API_BASE}/${mbAdminId}/sales_invoices/${moneybird_invoice_id}/download_pdf.json`, { headers: mbHeaders, redirect: "follow" });
      if (!pdfRes.ok) throw new Error(`PDF download failed [${pdfRes.status}]`);
      const pdfBuffer = await pdfRes.arrayBuffer();
      const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));

      // 3d. Build branded HTML email
      const invoiceNumber = invoice.invoice_id || moneybird_invoice_id;
      const totalAmount = invoice.total_price_incl_tax || "0";
      const paymentUrl = invoice.payment_url || "";
      const contactName = `${contact.firstname || ""} ${contact.lastname || ""}`.trim() || contact.company_name || "";

      const emailHtml = buildInvoiceEmailHtml({
        type: "invoice",
        contactName,
        invoiceNumber,
        totalAmount,
        paymentUrl,
      });

      // 3e. Send via outlook-send with PDF attachment
      const outlookRes = await fetch(`${supabaseUrl}/functions/v1/outlook-send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          to: recipientEmail,
          to_name: contactName,
          subject: `Factuur ${invoiceNumber} — Streetgasm`,
          body_html: emailHtml,
          attachments: [{
            name: `factuur-${invoiceNumber}.pdf`,
            content_type: "application/pdf",
            content_base64: pdfBase64,
          }],
        }),
      });

      if (!outlookRes.ok) {
        const err = await outlookRes.text();
        throw new Error(`Outlook send failed [${outlookRes.status}]: ${err}`);
      }
      const outlookResult = await outlookRes.json();
      if (outlookResult.blocked) {
        return new Response(JSON.stringify(outlookResult), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase
        .from("moneybird_invoices")
        .update({ status: "sent" })
        .eq("moneybird_invoice_id", moneybird_invoice_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: financial_summary ──
    if (action === "financial_summary") {
      const states = ["open", "late", "paid"];
      const summaryPromises = states.map(async (state) => {
        // Moneybird uses filter=state:{value} query param syntax
        const url = `${MONEYBIRD_API_BASE}/${mbAdminId}/sales_invoices.json?filter=state:${state}&per_page=100`;
        console.log(`[MB] financial_summary fetching state=${state}: ${url}`);
        const res = await fetch(url, { headers: mbHeaders });
        if (!res.ok) {
          const errText = await res.text();
          console.error(`[MB] financial_summary state=${state} failed [${res.status}]: ${errText}`);
          return { state, count: 0, total: 0 };
        }
        const invoices = await res.json();
        console.log(`[MB] financial_summary state=${state}: ${invoices.length} invoices`);
        const total = invoices.reduce((sum: number, inv: any) => sum + parseFloat(inv.total_price_incl_tax || "0"), 0);
        return { state, count: invoices.length, total };
      });
      const results = await Promise.all(summaryPromises);
      const summary: Record<string, { count: number; total: number }> = {};
      results.forEach((r) => {
        summary[r.state] = { count: r.count, total: r.total };
      });
      return new Response(JSON.stringify({ success: true, summary }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: send_reminder ──
    if (action === "send_reminder") {
      if (!moneybird_invoice_id || !contact_id) {
        return new Response(JSON.stringify({ error: "Missing moneybird_invoice_id or contact_id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (emailSendMode === "test") {
        console.log(`[MB-INVOICE] TESTMODUS: send_reminder geblokkeerd voor ${moneybird_invoice_id}`);
        return new Response(JSON.stringify({ blocked: true, reason: "Testmodus actief — herinnering wordt niet verstuurd" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 1. Fetch invoice + contact
      const invoiceRes = await fetch(`${MONEYBIRD_API_BASE}/${mbAdminId}/sales_invoices/${moneybird_invoice_id}.json`, { headers: mbHeaders });
      if (!invoiceRes.ok) throw new Error(`Fetch invoice failed [${invoiceRes.status}]: ${await invoiceRes.text()}`);
      const invoiceData = await invoiceRes.json();

      const contactRes = await fetch(`${MONEYBIRD_API_BASE}/${mbAdminId}/contacts/${contact_id}.json`, { headers: mbHeaders });
      if (!contactRes.ok) throw new Error(`Fetch contact failed [${contactRes.status}]: ${await contactRes.text()}`);
      const contact = await contactRes.json();
      const recipientEmail = contact.email;
      if (!recipientEmail) throw new Error("Contact heeft geen e-mailadres in Moneybird");

      // 2. Download PDF
      const pdfRes = await fetch(`${MONEYBIRD_API_BASE}/${mbAdminId}/sales_invoices/${moneybird_invoice_id}/download_pdf.json`, { headers: mbHeaders, redirect: "follow" });
      if (!pdfRes.ok) throw new Error(`PDF download failed [${pdfRes.status}]`);
      const pdfBuffer = await pdfRes.arrayBuffer();
      const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));

      // 3. Build reminder email
      const invoiceNumber = invoiceData.invoice_id || moneybird_invoice_id;
      const totalAmount = invoiceData.total_price_incl_tax || "0";
      const paymentUrl = invoiceData.payment_url || "";
      const contactName = `${contact.firstname || ""} ${contact.lastname || ""}`.trim() || contact.company_name || "";

      const emailHtml = buildInvoiceEmailHtml({
        type: "reminder",
        contactName,
        invoiceNumber,
        totalAmount,
        paymentUrl,
      });

      // 4. Send via outlook-send
      const outlookRes = await fetch(`${supabaseUrl}/functions/v1/outlook-send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          to: recipientEmail,
          to_name: contactName,
          subject: `Herinnering: Factuur ${invoiceNumber} — Streetgasm`,
          body_html: emailHtml,
          attachments: [{
            name: `factuur-${invoiceNumber}.pdf`,
            content_type: "application/pdf",
            content_base64: pdfBase64,
          }],
        }),
      });

      if (!outlookRes.ok) {
        const err = await outlookRes.text();
        throw new Error(`Outlook send failed [${outlookRes.status}]: ${err}`);
      }
      const outlookResult = await outlookRes.json();
      if (outlookResult.blocked) {
        return new Response(JSON.stringify(outlookResult), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase
        .from("moneybird_invoices")
        .update({ status: "reminded" })
        .eq("moneybird_invoice_id", moneybird_invoice_id);

      await supabase.from("activity_log").insert({
        action: "moneybird_reminder_sent",
        entity_type: "moneybird_invoice",
        entity_id: moneybird_invoice_id,
        details: { contact_id },
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: get_invoice_pdf ──
    if (action === "get_invoice_pdf") {
      if (!moneybird_invoice_id) {
        return new Response(JSON.stringify({ error: "Missing moneybird_invoice_id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const pdfRes = await fetch(
        `${MONEYBIRD_API_BASE}/${mbAdminId}/sales_invoices/${moneybird_invoice_id}/download_pdf.json`,
        { headers: mbHeaders, redirect: "manual" }
      );

      if (pdfRes.status === 302) {
        const pdfUrl = pdfRes.headers.get("Location");
        return new Response(JSON.stringify({ success: true, pdf_url: pdfUrl }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const pdfData = await pdfRes.text();
      throw new Error(`PDF download failed [${pdfRes.status}]: ${pdfData}`);
    }

    // ── Action: update_contact ──
    if (action === "update_contact") {
      if (!contact_id || !contact_data) {
        return new Response(JSON.stringify({ error: "Missing contact_id or contact_data" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const updateRes = await fetch(
        `${MONEYBIRD_API_BASE}/${mbAdminId}/contacts/${contact_id}.json`,
        {
          method: "PATCH",
          headers: mbHeaders,
          body: JSON.stringify({ contact: contact_data }),
        }
      );

      if (!updateRes.ok) {
        const err = await updateRes.text();
        throw new Error(`Contact update failed [${updateRes.status}]: ${err}`);
      }

      const updated = await updateRes.json();

      await supabase.from("activity_log").insert({
        action: "moneybird_contact_updated",
        entity_type: "member",
        entity_id: contact_id,
        details: { fields_updated: Object.keys(contact_data) },
      });

      return new Response(JSON.stringify({ success: true, contact: updated }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: delete_contact ──
    if (action === "delete_contact") {
      if (!contact_id) {
        return new Response(JSON.stringify({ error: "Missing contact_id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const res = await fetch(`${MONEYBIRD_API_BASE}/${mbAdminId}/contacts/${contact_id}.json`, {
        method: "DELETE",
        headers: mbHeaders,
      });
      if (!res.ok) throw new Error(`Delete contact failed [${res.status}]: ${await res.text()}`);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: create_standalone_invoice ──
    if (action === "create_standalone_invoice") {
      if (!contact_id) {
        return new Response(JSON.stringify({ error: "Missing contact_id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const lines = body.lines || [];
      if (!lines.length) {
        return new Response(JSON.stringify({ error: "Missing invoice lines" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const reference = body.reference || "";
      const details_attributes = lines.map((l: any) => ({
        description: l.description || "",
        price: String(l.price || "0"),
        amount: String(l.amount || "1"),
        tax_rate_id: l.tax_rate_id || undefined,
        ledger_account_id: l.ledger_account_id || undefined,
        product_id: l.product_id || undefined,
      }));

      const invoicePayload: Record<string, unknown> = {
        contact_id,
        reference,
        details_attributes,
      };
      if (body.invoice_date) invoicePayload.invoice_date = body.invoice_date;
      if (body.due_date) invoicePayload.due_date = body.due_date;

      const invoiceRes = await fetch(`${MONEYBIRD_API_BASE}/${mbAdminId}/sales_invoices.json`, {
        method: "POST",
        headers: mbHeaders,
        body: JSON.stringify({
          sales_invoice: invoicePayload,
        }),
      });
      if (!invoiceRes.ok) {
        const err = await invoiceRes.text();
        throw new Error(`Invoice creation failed [${invoiceRes.status}]: ${err}`);
      }
      const invoice = await invoiceRes.json();

      let finalStatus = "draft";
      if (body.send_immediately) {
        if (emailSendMode === "test") {
          console.log(`[MB-INVOICE] TESTMODUS: send_immediately geblokkeerd voor standalone invoice ${invoice.id}`);
        } else {
          try {
            // Fetch contact for email
            const ctRes = await fetch(`${MONEYBIRD_API_BASE}/${mbAdminId}/contacts/${contact_id}.json`, { headers: mbHeaders });
            const ct = ctRes.ok ? await ctRes.json() : null;
            const recipientEmail = ct?.email;

            if (recipientEmail) {
              // Download PDF
              const pdfRes = await fetch(`${MONEYBIRD_API_BASE}/${mbAdminId}/sales_invoices/${invoice.id}/download_pdf.json`, { headers: mbHeaders, redirect: "follow" });
              if (pdfRes.ok) {
                const pdfBuf = await pdfRes.arrayBuffer();
                const pdfB64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuf)));
                const invNum = invoice.invoice_id || invoice.id;
                const ctName = `${ct.firstname || ""} ${ct.lastname || ""}`.trim() || ct.company_name || "";

                const emailHtml = buildInvoiceEmailHtml({
                  type: "invoice",
                  contactName: ctName,
                  invoiceNumber: invNum,
                  totalAmount: invoice.total_price_incl_tax || "0",
                  paymentUrl: invoice.payment_url || "",
                });

                const outlookRes = await fetch(`${supabaseUrl}/functions/v1/outlook-send`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
                  body: JSON.stringify({
                    to: recipientEmail,
                    to_name: ctName,
                    subject: `Factuur ${invNum} — Streetgasm`,
                    body_html: emailHtml,
                    attachments: [{ name: `factuur-${invNum}.pdf`, content_type: "application/pdf", content_base64: pdfB64 }],
                  }),
                });
                const olResult = await outlookRes.json();
                if (outlookRes.ok && !olResult.blocked) finalStatus = "sent";
              }
            }
          } catch (e) {
            console.warn("[MB] Send after create failed:", e);
          }
        }
      }

      await supabase.from("activity_log").insert({
        action: "moneybird_standalone_invoice_created",
        entity_type: "moneybird_invoice",
        entity_id: invoice.id,
        details: { contact_id, reference, status: finalStatus, total: invoice.total_price_incl_tax },
      });

      return new Response(JSON.stringify({
        success: true,
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_id,
        invoice_url: invoice.url,
        payment_url: invoice.payment_url,
        status: finalStatus,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Action: create_membership_subscription ──
    // Creates a Moneybird contact + subscription (recurring). First invoice auto-generated.
    if (action === "create_membership_subscription") {
      let contactId: string | null = null;
      const effectiveWcId = wc_customer_id && Number(wc_customer_id) > 0 ? Number(wc_customer_id) : null;

      // Resolve contact: use contact_info for signups, or WC customer data for existing members
      if (contact_info && !effectiveWcId) {
        contactId = await findOrCreateContactFromInfo(contact_info, mbHeaders, mbAdminId, supabase, effectiveWcId);
      } else if (effectiveWcId) {
        const { data: customer, error: custErr } = await supabase
          .from("wc_customers")
          .select("*")
          .eq("id", effectiveWcId)
          .maybeSingle();

        if (custErr || !customer) {
          // Fallback to contact_info if customer not found
          if (contact_info) {
            contactId = await findOrCreateContactFromInfo(contact_info, mbHeaders, mbAdminId, supabase, effectiveWcId);
          } else {
            return new Response(JSON.stringify({ error: "Customer not found and no contact_info provided" }), {
              status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } else {
          contactId = await findOrCreateContactFromWC(customer, effectiveWcId, mbHeaders, mbAdminId, supabase);
        }
      } else if (contact_info) {
        contactId = await findOrCreateContactFromInfo(contact_info, mbHeaders, mbAdminId, supabase, null);
      } else {
        return new Response(JSON.stringify({ error: "Missing wc_customer_id or contact_info" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!contactId) {
        return new Response(JSON.stringify({ error: "Could not resolve Moneybird contact" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create Moneybird subscription (or fallback to sales_invoice if product has no frequency)
      const startDate = body.start_date || new Date().toISOString().split("T")[0];
      const reference = signup_id ? `SG-signup-${signup_id}` : `SG-${effectiveWcId || "new"}-membership`;

      // Resolve workflow_id from request body or system settings
      let resolvedWorkflowId = body.workflow_id || null;
      if (!resolvedWorkflowId) {
        try {
          const { data: wfData } = await supabase.rpc("decrypt_setting", {
            p_key: "MONEYBIRD_WORKFLOW_ID",
            p_passphrase: encryptionKey,
          });
          if (wfData) resolvedWorkflowId = wfData;
        } catch { /* no workflow configured */ }
      }

      // Resolve product_id: use provided, or fallback to system setting
      let resolvedProductId = product_id ? String(product_id) : null;
      if (!resolvedProductId) {
        try {
          const { data: pidData } = await supabase.rpc("decrypt_setting", {
            p_key: "MONEYBIRD_MEMBERSHIP_PRODUCT_ID",
            p_passphrase: encryptionKey,
          });
          if (pidData) resolvedProductId = pidData;
        } catch { /* no default product */ }
      }

      if (!resolvedProductId) {
        return new Response(JSON.stringify({ error: "Moneybird Membership Product ID is niet geconfigureerd. Stel dit in via Instellingen > Administratie." }), {
          status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── Fetch product from Moneybird to check if it has a frequency ──
      let productHasFrequency = false;
      try {
        const prodRes = await fetch(`${MONEYBIRD_API_BASE}/${mbAdminId}/products/${resolvedProductId}.json`, { headers: mbHeaders });
        if (prodRes.ok) {
          const prod = await prodRes.json();
          productHasFrequency = !!(prod.frequency_type && prod.frequency && Number(prod.frequency) > 0);
          console.log(`[MB] Product ${resolvedProductId} frequency: type=${prod.frequency_type}, amount=${prod.frequency}, hasFrequency=${productHasFrequency}`);
        } else {
          await prodRes.text(); // consume body
          console.warn(`[MB] Could not fetch product ${resolvedProductId}, assuming no frequency`);
        }
      } catch (e) {
        console.warn(`[MB] Error fetching product ${resolvedProductId}:`, e);
      }

      let subscription: any = null;
      let firstInvoice: any = null;
      let localInvoiceId: string | null = null;

      if (productHasFrequency) {
        // ── Product has frequency: create subscription (recurring) ──
        const frequencyType = body.frequency || "year";
        const frequencyAmount = body.frequency_amount || 1;

        const subscriptionPayload: Record<string, unknown> = {
          contact_id: contactId,
          product_id: resolvedProductId,
          start_date: startDate,
          reference,
          frequency: frequencyAmount,
          frequency_type: frequencyType,
        };
        if (resolvedWorkflowId) {
          subscriptionPayload.workflow_id = resolvedWorkflowId;
        }
        console.log(`[MB] Creating subscription for contact ${contactId} with product ${resolvedProductId}:`, JSON.stringify(subscriptionPayload));

        const subRes = await fetch(`${MONEYBIRD_API_BASE}/${mbAdminId}/subscriptions.json`, {
          method: "POST",
          headers: mbHeaders,
          body: JSON.stringify({ subscription: subscriptionPayload }),
        });

        if (!subRes.ok) {
          const err = await subRes.text();
          console.error(`[MB] Subscription creation failed [${subRes.status}]:`, err);
          throw new Error(`Moneybird subscription creation failed [${subRes.status}]: ${err}`);
        }

        subscription = await subRes.json();
        console.log(`[MB-INVOICE] Subscription created: ${subscription.id}`);

        // Fetch the first invoice generated by the subscription
        try {
          const invListRes = await fetch(
            `${MONEYBIRD_API_BASE}/${mbAdminId}/sales_invoices.json?contact_id=${contactId}&per_page=5`,
            { headers: mbHeaders }
          );
          if (invListRes.ok) {
            const invList = await invListRes.json();
            if (Array.isArray(invList) && invList.length > 0) {
              firstInvoice = invList[0];
            }
          } else {
            await invListRes.text();
          }
        } catch (e) {
          console.warn("[MB-INVOICE] Could not fetch first subscription invoice:", e);
        }
      } else {
        // ── Product has NO frequency: create a one-time sales_invoice instead ──
        console.log(`[MB] Product ${resolvedProductId} has no frequency, creating sales_invoice instead of subscription`);
        const invoiceAmount = amount || "2250.00";
        const invoiceDescription = description || "Lidmaatschap StreetGasm";

        const invoiceRes = await fetch(`${MONEYBIRD_API_BASE}/${mbAdminId}/sales_invoices.json`, {
          method: "POST",
          headers: mbHeaders,
          body: JSON.stringify({
            sales_invoice: {
              contact_id: contactId,
              reference,
              details_attributes: [{
                description: invoiceDescription,
                price: String(invoiceAmount),
                amount: "1",
                product_id: resolvedProductId,
              }],
            },
          }),
        });

        if (!invoiceRes.ok) {
          const err = await invoiceRes.text();
          console.error(`[MB] Sales invoice creation failed [${invoiceRes.status}]:`, err);
          throw new Error(`Moneybird invoice creation failed [${invoiceRes.status}]: ${err}`);
        }

        firstInvoice = await invoiceRes.json();
        console.log(`[MB-INVOICE] Sales invoice created as fallback: ${firstInvoice.id}`);
      }

      // Save to local moneybird_invoices table
      const invoiceAmount = amount || (firstInvoice?.total_price_incl_tax) || "2250.00";
      const invoiceDescription = description || "Lidmaatschap StreetGasm";
      const localInvoice = await supabase.from("moneybird_invoices").insert({
        wc_customer_id: effectiveWcId || 0,
        moneybird_contact_id: contactId,
        moneybird_invoice_id: firstInvoice?.id || null,
        moneybird_subscription_id: subscription?.id || null,
        invoice_type: "membership",
        product_id: product_id ? Number(product_id) : null,
        amount: parseFloat(String(invoiceAmount)),
        description: invoiceDescription,
        status: "draft",
        signup_id: signup_id || null,
        invoice_number: firstInvoice?.invoice_id || null,
        due_date: firstInvoice?.due_date || null,
        payment_url: firstInvoice?.payment_url || null,
        invoice_url: firstInvoice?.url || null,
      }).select("id").single();
      localInvoiceId = localInvoice?.data?.id || null;

      // If WC customer exists, store IDs in moneybird jsonb
      if (effectiveWcId) {
        const { data: existingCust } = await supabase
          .from("wc_customers")
          .select("moneybird")
          .eq("id", effectiveWcId)
          .maybeSingle();
        const existingMb = (existingCust?.moneybird || {}) as Record<string, string>;
        const mbUpdate: Record<string, string> = { ...existingMb, contact_id: contactId };
        if (subscription?.id) mbUpdate.subscription_id = subscription.id;
        await supabase
          .from("wc_customers")
          .update({ moneybird: mbUpdate })
          .eq("id", effectiveWcId);
      }

      await supabase.from("activity_log").insert({
        action: subscription ? "moneybird_subscription_created" : "moneybird_invoice_created",
        entity_type: signup_id ? "signup" : "member",
        entity_id: signup_id || String(effectiveWcId),
        details: {
          moneybird_subscription_id: subscription?.id || null,
          moneybird_contact_id: contactId,
          moneybird_invoice_id: firstInvoice?.id || null,
          used_fallback_invoice: !productHasFrequency,
        },
      });

      return new Response(JSON.stringify({
        success: true,
        moneybird_subscription_id: subscription?.id || null,
        moneybird_contact_id: contactId,
        moneybird_invoice_id: firstInvoice?.id || null,
        invoice_number: firstInvoice?.invoice_id || null,
        local_invoice_id: localInvoiceId,
        used_fallback_invoice: !productHasFrequency,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Action: create_subscription (legacy, for existing WC members) ──
    if (action === "create_subscription") {
      if (!wc_customer_id) {
        return new Response(JSON.stringify({ error: "Missing wc_customer_id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: customer } = await supabase
        .from("wc_customers")
        .select("moneybird")
        .eq("id", Number(wc_customer_id))
        .maybeSingle();

      const mb = (customer?.moneybird || {}) as Record<string, string>;
      if (!mb.contact_id) {
        return new Response(
          JSON.stringify({ error: "Lid heeft nog geen Moneybird contact. Contact wordt aangemaakt bij factuurcreatie." }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const startDate = body.start_date || new Date().toISOString().split("T")[0];
      const frequencyType = body.frequency || "year";
      const frequencyAmount = body.frequency_amount || 1;

      // Resolve product_id: use provided, or fallback to system setting
      let resolvedProductId = product_id ? String(product_id) : null;
      if (!resolvedProductId) {
        try {
          const { data: pidData } = await supabase.rpc("decrypt_setting", {
            p_key: "MONEYBIRD_MEMBERSHIP_PRODUCT_ID",
            p_passphrase: encryptionKey,
          });
          if (pidData) resolvedProductId = pidData;
        } catch { /* no default product */ }
      }

      if (!resolvedProductId) {
        return new Response(JSON.stringify({ error: "Moneybird Membership Product ID is niet geconfigureerd." }), {
          status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Resolve workflow_id from request body or system settings
      let resolvedWorkflowId = body.workflow_id || null;
      if (!resolvedWorkflowId) {
        try {
          const { data: wfData } = await supabase.rpc("decrypt_setting", {
            p_key: "MONEYBIRD_WORKFLOW_ID",
            p_passphrase: encryptionKey,
          });
          if (wfData) resolvedWorkflowId = wfData;
        } catch { /* no workflow configured */ }
      }

      const legacySubPayload: Record<string, unknown> = {
        contact_id: mb.contact_id,
        product_id: resolvedProductId,
        start_date: startDate,
        reference: `WC-${wc_customer_id}-membership`,
        frequency: frequencyAmount,
        frequency_type: frequencyType,
      };
      if (resolvedWorkflowId) {
        legacySubPayload.workflow_id = resolvedWorkflowId;
      }
      console.log(`[MB] Creating legacy subscription for WC ${wc_customer_id}:`, JSON.stringify(legacySubPayload));

      const subRes = await fetch(`${MONEYBIRD_API_BASE}/${mbAdminId}/subscriptions.json`, {
        method: "POST",
        headers: mbHeaders,
        body: JSON.stringify({ subscription: legacySubPayload }),
      });

      if (!subRes.ok) {
        const err = await subRes.text();
        console.error(`[MB] Legacy subscription creation failed [${subRes.status}]:`, err);
        throw new Error(`Moneybird subscription creation failed [${subRes.status}]: ${err}`);
      }

      const subscription = await subRes.json();

      await supabase
        .from("wc_customers")
        .update({ moneybird: { ...mb, subscription_id: subscription.id } })
        .eq("id", Number(wc_customer_id));

      await supabase.from("activity_log").insert({
        action: "moneybird_subscription_created",
        entity_type: "member",
        entity_id: String(wc_customer_id),
        details: { moneybird_subscription_id: subscription.id, frequency },
      });

      return new Response(
        JSON.stringify({ success: true, moneybird_subscription_id: subscription.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Invoice creation actions (require wc_customer_id or contact_info) ──
    // Resolve contact based on available data
    let resolvedContactId: string | null = null;
    const effectiveWcId = wc_customer_id && Number(wc_customer_id) > 0 ? Number(wc_customer_id) : null;

    if (contact_info && !effectiveWcId) {
      // New signup: use contact_info directly
      resolvedContactId = await findOrCreateContactFromInfo(contact_info, mbHeaders, mbAdminId, supabase, effectiveWcId);
    } else if (effectiveWcId) {
      // Existing WC customer
      const { data: customer, error: custErr } = await supabase
        .from("wc_customers")
        .select("*")
        .eq("id", effectiveWcId)
        .maybeSingle();

      if (custErr || !customer) {
        if (contact_info) {
          resolvedContactId = await findOrCreateContactFromInfo(contact_info, mbHeaders, mbAdminId, supabase, effectiveWcId);
        } else {
          return new Response(JSON.stringify({ error: "Customer not found" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        resolvedContactId = await findOrCreateContactFromWC(customer, effectiveWcId, mbHeaders, mbAdminId, supabase);
      }
    } else {
      return new Response(JSON.stringify({ error: "Missing wc_customer_id or contact_info" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: Create invoice
    const invoiceType = action === "create_membership_invoice" ? "membership" : "event";
    const invoiceDescription = description || (invoiceType === "membership" ? "Lidmaatschap StreetGasm" : "Event registratie");
    const invoiceAmount = amount || "0";

    const invoiceRes = await fetch(`${MONEYBIRD_API_BASE}/${mbAdminId}/sales_invoices.json`, {
      method: "POST",
      headers: mbHeaders,
      body: JSON.stringify({
        sales_invoice: {
          contact_id: resolvedContactId,
          reference: `WC-${effectiveWcId || "signup"}-${invoiceType}-${Date.now()}`,
          details_attributes: [
            {
              description: invoiceDescription,
              price: invoiceAmount,
              amount: "1",
            },
          ],
        },
      }),
    });

    if (!invoiceRes.ok) {
      const err = await invoiceRes.text();
      throw new Error(`Moneybird invoice creation failed [${invoiceRes.status}]: ${err}`);
    }

    const invoice = await invoiceRes.json();

    // Step 3: Send the invoice (blocked in test mode)
    let finalStatus = "draft";
    if (emailSendMode === "test") {
      console.log(`[MB-INVOICE] TESTMODUS: auto-send geblokkeerd voor invoice ${invoice.id}`);
    } else {
      try {
        const sendRes = await fetch(
          `${MONEYBIRD_API_BASE}/${mbAdminId}/sales_invoices/${invoice.id}/send_invoice.json`,
          {
            method: "PATCH",
            headers: mbHeaders,
            body: JSON.stringify({ sales_invoice_sending: { delivery_method: "Email" } }),
          }
        );
        if (sendRes.ok) {
          finalStatus = "sent";
        } else {
          const sendErr = await sendRes.text();
          console.warn(`[MB-INVOICE] Could not send invoice ${invoice.id}: ${sendErr}`);
        }
      } catch (sendError) {
        console.warn("[MB-INVOICE] Send invoice failed, keeping as draft:", sendError);
      }
    }

    // Step 4: Save to moneybird_invoices table
    const localInsert = await supabase.from("moneybird_invoices").insert({
      wc_customer_id: effectiveWcId || 0,
      moneybird_contact_id: resolvedContactId,
      moneybird_invoice_id: invoice.id,
      invoice_type: invoiceType,
      product_id: product_id ? Number(product_id) : null,
      amount: parseFloat(invoiceAmount),
      description: invoiceDescription,
      status: finalStatus,
      signup_id: signup_id || null,
      invoice_number: invoice.invoice_id || null,
      due_date: invoice.due_date || null,
      payment_url: invoice.payment_url || null,
      invoice_url: invoice.url || null,
    }).select("id").single();

    // Step 5: Log activity
    await supabase.from("activity_log").insert({
      action: `moneybird_invoice_created`,
      entity_type: invoiceType,
      entity_id: signup_id || String(effectiveWcId),
      details: {
        moneybird_invoice_id: invoice.id,
        invoice_number: invoice.invoice_id,
        contact_id: resolvedContactId,
        amount: invoiceAmount,
        description: invoiceDescription,
        status: finalStatus,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        moneybird_invoice_id: invoice.id,
        moneybird_contact_id: resolvedContactId,
        invoice_number: invoice.invoice_id,
        invoice_url: invoice.url,
        payment_url: invoice.payment_url,
        status: finalStatus,
        local_invoice_id: localInsert?.data?.id || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const rawMessage = error.message || String(error);
    console.error(`[MB] Error in action '${body?.action || "unknown"}':`, rawMessage);

    // Map known Moneybird errors to readable Dutch messages
    let leesbareMelding = rawMessage;
    if (rawMessage.includes("regular administrations")) {
      leesbareMelding = "Je Moneybird-administratie is een proefomgeving. Subscriptions werken alleen in een reguliere administratie.";
    } else if (rawMessage.includes('"frequency"') && rawMessage.includes("blank")) {
      leesbareMelding = "Frequentie ontbreekt in het product. Vul dit veld in bij het product in Moneybird.";
    } else if (rawMessage.includes('"ledger_account"') && rawMessage.includes("blank")) {
      leesbareMelding = "Grootboekrekening ontbreekt. Selecteer een grootboekrekening bij het product.";
    } else if (rawMessage.includes("contact creation failed")) {
      leesbareMelding = "Moneybird-contact kon niet worden aangemaakt. Controleer de klantgegevens.";
    }

    return new Response(JSON.stringify({
      error: leesbareMelding,
      action: body?.action || "unknown",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
