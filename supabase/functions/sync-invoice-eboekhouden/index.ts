import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EB_BASE = "https://api.e-boekhouden.nl/v1";

function eboekhoudenVatCode(vatPct: number): string {
  if (vatPct === 0) return "GEEN";
  if (vatPct === 9) return "LAAG_VERK_9";
  return "HOOG_VERK_21";
}

function sanitizeEmail(email: string | null): string {
  if (!email) return "";
  const trimmed = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : "";
}

function sanitizePhone(phone: string | null): string {
  if (!phone) return "";
  let cleaned = phone.replace(/[\s\-\(\)]/g, "");
  if (cleaned.startsWith("0") && !cleaned.startsWith("00")) {
    cleaned = "+31" + cleaned.substring(1);
  }
  return /^\+?\d{7,15}$/.test(cleaned) ? cleaned : "";
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

async function decryptToken(encrypted: string): Promise<string> {
  const keyHex = Deno.env.get("SMTP_ENCRYPTION_KEY");
  if (!keyHex) throw new Error("Encryptiesleutel niet geconfigureerd");

  let keyBytes: Uint8Array;
  if (keyHex.length === 64 && /^[0-9a-fA-F]+$/.test(keyHex)) {
    keyBytes = hexToBytes(keyHex);
  } else {
    const binary = atob(keyHex);
    keyBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      keyBytes[i] = binary.charCodeAt(i);
    }
  }

  const key = await crypto.subtle.importKey(
    "raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]
  );

  const [ivB64, ctB64] = encrypted.split(":");
  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
  const ct = Uint8Array.from(atob(ctB64), (c) => c.charCodeAt(0));

  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(decrypted);
}

async function ebSession(apiToken: string, source = "VentFlow"): Promise<string> {
  const res = await fetch(`${EB_BASE}/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken: apiToken, source }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`e-Boekhouden sessie mislukt: ${err}`);
  }
  const data = await res.json();
  return data.token ?? data.Token ?? data.sessionToken;
}

async function ebGet(session: string, path: string) {
  const res = await fetch(`${EB_BASE}${path}`, {
    headers: { Authorization: session },
  });
  if (!res.ok) throw new Error(`e-Boekhouden GET ${path}: ${await res.text()}`);
  return res.json();
}

async function ebPost(session: string, path: string, body: unknown) {
  const res = await fetch(`${EB_BASE}${path}`, {
    method: "POST",
    headers: { Authorization: session, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`e-Boekhouden POST ${path}: ${await res.text()}`);
  return res.json();
}

async function ebPatch(session: string, path: string, body: unknown) {
  const res = await fetch(`${EB_BASE}${path}`, {
    method: "PATCH",
    headers: { Authorization: session, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`e-Boekhouden PATCH ${path}: ${await res.text()}`);
  if (res.status === 204) return {};
  return res.json();
}

// Helper: map invoice items JSONB to e-Boekhouden items array
// Prices in DB are stored INCLUSIVE of VAT, so we use inExVat: "IN"
function mapInvoiceItems(invoice: any, ledgerId: number): any[] {
  const vatPct = Number(invoice.vat_percentage || 21);
  const vatCode = eboekhoudenVatCode(vatPct);
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  
  if (items.length > 0) {
    return items.map((item: any) => ({
      description: item.description || "Item",
      quantity: Number(item.qty || 1),
      pricePerUnit: Number(item.unit_price || 0),
      vatCode,
      ledgerId,
    }));
  }
  
  // Fallback: single item from subtotal (legacy invoices without items)
  const wo = invoice.work_orders as any;
  const serviceName = wo?.services?.name ?? "Dienst";
  return [{
    description: serviceName,
    quantity: 1,
    pricePerUnit: Number(invoice.total || 0),
    vatCode,
    ledgerId,
  }];
}

// Helper: calculate termOfPayment from issued_at and due_at
function calcTermOfPayment(invoice: any): number {
  if (invoice.issued_at && invoice.due_at) {
    const issued = new Date(invoice.issued_at);
    const due = new Date(invoice.due_at);
    const diffDays = Math.round((due.getTime() - issued.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 0) return diffDays;
  }
  return 30;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { action, invoice_id, customer_id, quote_id } = body;

    // Action: auto-sync — cron-triggered, syncs all users with e-Boekhouden tokens
    if (action === "auto-sync") {
      // Verify X-Cron-Secret to prevent unauthenticated access
      const cronSecret = Deno.env.get("CRON_SECRET");
      const requestSecret = req.headers.get("X-Cron-Secret") || req.headers.get("x-cron-secret");
      if (!cronSecret || requestSecret !== cronSecret) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Get companies with e-Boekhouden tokens configured
      const { data: companies } = await supabase
        .from("companies")
        .select("id, eboekhouden_api_token, eboekhouden_template_id, eboekhouden_ledger_id, eboekhouden_debtor_ledger_id")
        .not("eboekhouden_api_token", "is", null);

      if (!companies || companies.length === 0) {
        return new Response(JSON.stringify({ message: "Geen bedrijven met e-Boekhouden token gevonden" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const results: any[] = [];

      for (const comp of companies) {
        try {
          const apiToken = await decryptToken(comp.eboekhouden_api_token!);
          const sess = await ebSession(apiToken);
          const log: any = { company_id: comp.id };

          // 1. Pull contacts
          try {
            let allRelations: any[] = [];
            let offset = 0;
            const limit = 2000;
            while (true) {
              const raw = await ebGet(sess, `/relation?limit=${limit}&offset=${offset}`);
              const items = raw?.items ?? (Array.isArray(raw) ? raw : []);
              allRelations = allRelations.concat(items);
              if (items.length < limit) break;
              offset += limit;
            }
            let cUpdated = 0, cCreated = 0;
            for (const rel of allRelations) {
              try {
                const detail = await ebGet(sess, `/relation/${rel.id}`);
                const customerData: Record<string, any> = {
                  name: detail.name || detail.contact || `Relatie ${rel.id}`,
                  address: detail.address || null,
                  postal_code: detail.postalCode || null,
                  city: detail.city || null,
                  email: sanitizeEmail(detail.emailAddress) || null,
                  phone: sanitizePhone(detail.phoneNumber) || null,
                  eboekhouden_relation_id: rel.id,
                };
                const { data: existing } = await supabase.from("customers").select("id").eq("eboekhouden_relation_id", rel.id).eq("company_id", comp.id).maybeSingle();
                if (existing) {
                  await supabase.from("customers").update(customerData).eq("id", existing.id);
                  cUpdated++;
                } else {
                  customerData.company_id = comp.id;
                  await supabase.from("customers").insert(customerData);
                  cCreated++;
                }
              } catch { /* skip individual relation errors */ }
            }
            log.contacts = { total: allRelations.length, updated: cUpdated, created: cCreated };
          } catch (err: any) {
            log.contacts_error = err.message;
          }

          // 2. Pull invoices
          try {
            let allInvoices: any[] = [];
            let offset = 0;
            const limit = 2000;
            while (true) {
              const raw = await ebGet(sess, `/invoice?limit=${limit}&offset=${offset}`);
              const items = raw?.items ?? (Array.isArray(raw) ? raw : []);
              allInvoices = allInvoices.concat(items);
              if (items.length < limit) break;
              offset += limit;
            }
            const { data: existingInvoices } = await supabase.from("invoices").select("eboekhouden_id").eq("company_id", comp.id).not("eboekhouden_id", "is", null);
            const existingIds = new Set((existingInvoices || []).map((i: any) => String(i.eboekhouden_id)));
            const notImported = allInvoices.filter((inv: any) => !existingIds.has(String(inv.id)));
            let imported = 0;
            for (const ebInv of notImported) {
              try {
                const { data: customer } = await supabase.from("customers").select("id").eq("eboekhouden_relation_id", ebInv.relationId).eq("company_id", comp.id).maybeSingle();
                if (!customer) continue;
                const subtotal = Number(ebInv.totalExcl || 0);
                const total = Number(ebInv.totalAmount || ebInv.totalIncl || 0);
                const vatAmount = Number(ebInv.vatAmount || (total - subtotal));
                await supabase.from("invoices").insert({
                  customer_id: customer.id,
                  company_id: comp.id,
                  eboekhouden_id: String(ebInv.id),
                  invoice_number: ebInv.invoiceNumber || null,
                  subtotal, total, vat_amount: vatAmount,
                  status: "verzonden",
                  issued_at: ebInv.date || null,
                });
                imported++;
              } catch { /* skip individual invoice errors */ }
            }
            log.invoices = { total: allInvoices.length, imported };
          } catch (err: any) {
            log.invoices_error = err.message;
          }

          // 3. Pull invoice status (mark paid)
          try {
            const { data: unpaid } = await supabase.from("invoices").select("id, eboekhouden_id").eq("company_id", comp.id).not("eboekhouden_id", "is", null).neq("status", "betaald");
            let statusUpdated = 0;
            for (const inv of (unpaid || [])) {
              try {
                const ebInv = await ebGet(sess, `/invoice/${inv.eboekhouden_id}`);
                if (ebInv.paymentDate) {
                  await supabase.from("invoices").update({ status: "betaald", paid_at: ebInv.paymentDate }).eq("id", inv.id);
                  statusUpdated++;
                }
              } catch { /* skip */ }
            }
            log.status = { checked: (unpaid || []).length, updated: statusUpdated };
          } catch (err: any) {
            log.status_error = err.message;
          }

          // 4. Push: sync customers without eboekhouden_relation_id
          try {
            const { data: unsyncedCustomers } = await supabase.from("customers").select("*").eq("company_id", comp.id).is("eboekhouden_relation_id", null);
            let pushed = 0;
            for (const cust of (unsyncedCustomers || [])) {
              try {
                const newRel = await ebPost(sess, "/relation", {
                  type: cust.type === "zakelijk" ? "B" : "P",
                  name: cust.name,
                  contact: cust.contact_person || "",
                  address: cust.address || "",
                  postalCode: cust.postal_code || "",
                  city: cust.city || "",
                  emailAddress: sanitizeEmail(cust.email),
                  phoneNumber: sanitizePhone(cust.phone),
                });
                await supabase.from("customers").update({ eboekhouden_relation_id: newRel.id }).eq("id", cust.id);
                pushed++;
              } catch { /* skip */ }
            }
            log.push_contacts = { pushed };
          } catch (err: any) {
            log.push_contacts_error = err.message;
          }

          // 5. Push: sync invoices without eboekhouden_id (only if template/ledger configured)
          if (comp.eboekhouden_template_id && comp.eboekhouden_ledger_id) {
            try {
              const { data: unsyncedInvoices } = await supabase
                .from("invoices")
                .select("*, customers(id, name, type, contact_person, address, city, postal_code, email, phone, eboekhouden_relation_id), work_orders(work_order_number, services(name, price))")
                .eq("company_id", comp.id)
                .is("eboekhouden_id", null);
              let pushedInv = 0;
              for (const invoice of (unsyncedInvoices || [])) {
                try {
                  const customer = invoice.customers as any;
                  if (!customer) continue;
                  let relationId = customer.eboekhouden_relation_id;
                  if (!relationId) {
                    const newRel = await ebPost(sess, "/relation", {
                      type: customer.type === "zakelijk" ? "B" : "P",
                      name: customer.name, contact: customer.contact_person || "",
                      address: customer.address || "", postalCode: customer.postal_code || "",
                      city: customer.city || "", emailAddress: sanitizeEmail(customer.email),
                      phoneNumber: sanitizePhone(customer.phone),
                    });
                    relationId = newRel.id;
                    await supabase.from("customers").update({ eboekhouden_relation_id: relationId }).eq("id", customer.id);
                  }
                  const ebInvoice = await ebPost(sess, "/invoice", {
                    relationId,
                    invoiceNumber: invoice.invoice_number,
                    date: invoice.issued_at || new Date().toISOString().split("T")[0],
                    inExVat: "IN",
                    termOfPayment: calcTermOfPayment(invoice),
                    templateId: comp.eboekhouden_template_id,
                    mutation: { ledgerId: comp.eboekhouden_debtor_ledger_id || comp.eboekhouden_ledger_id },
                    items: mapInvoiceItems(invoice, comp.eboekhouden_ledger_id),
                  });
                  const ebId = String(ebInvoice.id ?? ebInvoice.Id ?? ebInvoice.invoiceId);
                  await supabase.from("invoices").update({ eboekhouden_id: ebId }).eq("id", invoice.id);
                  pushedInv++;
                } catch { /* skip */ }
              }
              log.push_invoices = { pushed: pushedInv };
            } catch (err: any) {
              log.push_invoices_error = err.message;
            }
          }

          results.push(log);
        } catch (err: any) {
          results.push({ company_id: comp.id, error: err.message });
        }
      }

      console.log("Auto-sync completed:", JSON.stringify(results));
      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authenticate the caller (for manual actions)
    const authHeader = req.headers.get("Authorization");
    console.log("Auth header present:", !!authHeader, "length:", authHeader?.length);
    if (!authHeader) throw new Error("Niet geautoriseerd: geen Authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    ).auth.getUser(token);
    console.log("getUser result - user:", !!user, "error:", authError?.message ?? "none");
    if (authError || !user) throw new Error("Niet geautoriseerd");

    // Verify caller is admin
    const { data: roleCheck } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleCheck) throw new Error("Niet geautoriseerd");

    // Get company_id from profile
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!userProfile?.company_id) {
      throw new Error("Geen bedrijf gevonden voor deze gebruiker.");
    }

    // Rate limit: max 5 syncs per minute per company
    await checkRateLimit(supabase, userProfile.company_id, "sync_eboekhouden", 5);

    // Get e-Boekhouden config from companies table (where save-smtp-credentials stores it)
    const { data: companyConfig } = await supabase
      .from("companies")
      .select("eboekhouden_api_token, eboekhouden_template_id, eboekhouden_ledger_id, eboekhouden_debtor_ledger_id")
      .eq("id", userProfile.company_id)
      .single();

    if (!companyConfig?.eboekhouden_api_token) {
      throw new Error("e-Boekhouden API-token niet ingesteld. Ga naar Instellingen.");
    }

    const profile = {
      company_id: userProfile.company_id,
      eboekhouden_api_token: companyConfig.eboekhouden_api_token,
      eboekhouden_template_id: companyConfig.eboekhouden_template_id,
      eboekhouden_ledger_id: companyConfig.eboekhouden_ledger_id,
      eboekhouden_debtor_ledger_id: companyConfig.eboekhouden_debtor_ledger_id,
    };

    // Decrypt the stored token
    const apiToken = await decryptToken(profile.eboekhouden_api_token);
    const session = await ebSession(apiToken);

    // Action: fetch templates
    if (action === "templates") {
      const raw = await ebGet(session, "/invoicetemplate");
      const templates = raw?.items ?? (Array.isArray(raw) ? raw : []);
      return new Response(JSON.stringify(templates), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: fetch ledgers (revenue)
    if (action === "ledgers") {
      const raw = await ebGet(session, "/ledger?category=VW");
      const ledgers = raw?.items ?? (Array.isArray(raw) ? raw : []);
      return new Response(JSON.stringify(ledgers), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: fetch debtor ledgers
    if (action === "debtor-ledgers") {
      const raw = await ebGet(session, "/ledger?category=DEB");
      const ledgers = raw?.items ?? (Array.isArray(raw) ? raw : []);
      return new Response(JSON.stringify(ledgers), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: test connection
    if (action === "test") {
      await ebGet(session, "/relation?limit=1");
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Helper: find or create relation for a customer
    async function ensureRelation(customer: any): Promise<number> {
      let relationId = customer.eboekhouden_relation_id;

      // Verify existing relation still exists in e-Boekhouden
      if (relationId) {
        try {
          await ebGet(session, `/relation/${relationId}`);
          return relationId; // Still valid
        } catch {
          console.warn(`e-Boekhouden relation ${relationId} no longer exists for customer ${customer.name}, re-resolving...`);
          relationId = null;
        }
      }

      // Search by name or create new
      try {
        const relationsRaw = await ebGet(session, `/relation?name=${encodeURIComponent(customer.name)}`);
        const relations = relationsRaw?.items ?? (Array.isArray(relationsRaw) ? relationsRaw : []);
        const existing = relations.find((r: any) => r.name === customer.name);

        if (existing) {
          relationId = existing.id;
          console.log(`ensureRelation: found existing relation ${relationId} for "${customer.name}"`);
        } else {
          console.log(`ensureRelation: no match found for "${customer.name}", creating new relation...`);
          const newRel = await ebPost(session, "/relation", {
            type: customer.type === "zakelijk" ? "B" : "P",
            name: customer.name,
            contact: customer.contact_person || "",
            address: customer.address || "",
            postalCode: customer.postal_code || "",
            city: customer.city || "",
            emailAddress: sanitizeEmail(customer.email),
            phoneNumber: sanitizePhone(customer.phone),
          });
          relationId = newRel.id;
          console.log(`ensureRelation: created new relation ${relationId} for "${customer.name}"`);
        }
      } catch (err: any) {
        console.error(`ensureRelation failed for "${customer.name}":`, err.message);
        throw new Error(`e-Boekhouden relatie aanmaken/zoeken mislukt voor "${customer.name}": ${err.message}`);
      }

      await supabase
        .from("customers")
        .update({ eboekhouden_relation_id: relationId })
        .eq("id", customer.id);

      return relationId;
    }

    // Action: sync-customer
    if (action === "sync-customer" && customer_id) {
      const { data: customer, error: custErr } = await supabase
        .from("customers")
        .select("*")
        .eq("id", customer_id)
        .single();
      if (custErr || !customer) throw new Error("Klant niet gevonden");

      // Always use ensureRelation to verify/create, then update
      const relationId = await ensureRelation(customer);
      try {
        await ebPatch(session, `/relation/${relationId}`, {
          type: customer.type === "zakelijk" ? "B" : "P",
          name: customer.name,
          contact: customer.contact_person || "",
          address: customer.address || "",
          postalCode: customer.postal_code || "",
          city: customer.city || "",
          emailAddress: sanitizeEmail(customer.email),
          phoneNumber: sanitizePhone(customer.phone),
        });
      } catch (patchErr) {
        console.warn(`e-Boekhouden relation patch failed for ${customer.name}, relation was already ensured:`, patchErr);
      }
      return new Response(JSON.stringify({ success: true, relation_id: relationId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: sync-quote
    if (action === "sync-quote" && quote_id) {
      if (!profile.eboekhouden_template_id || !profile.eboekhouden_ledger_id) {
        throw new Error("Stel eerst een factuursjabloon en grootboekrekening in via Instellingen → e-Boekhouden.");
      }

      const { data: quote, error: qErr } = await supabase
        .from("quotes")
        .select("*, customers(id, name, type, contact_person, address, city, postal_code, email, phone, eboekhouden_relation_id)")
        .eq("id", quote_id)
        .single();
      if (qErr || !quote) throw new Error("Offerte niet gevonden");

      const customer = quote.customers as any;
      if (!customer) throw new Error("Geen klant gekoppeld aan offerte");

      const relationId = await ensureRelation(customer);

      const items = Array.isArray(quote.items) ? quote.items : [];
      const quoteVatCode = eboekhoudenVatCode(Number(quote.vat_percentage || 21));
      const ebItems = items.map((item: any) => ({
        description: item.description || "Offerte item",
        pricePerUnit: Number(item.unit_price || 0),
        vatCode: quoteVatCode,
        ledgerId: profile.eboekhouden_ledger_id,
        quantity: Number(item.qty || 1),
      }));

      if (ebItems.length === 0) {
        ebItems.push({
          description: "Offerte",
          pricePerUnit: Number(quote.total || 0),
          vatCode: quoteVatCode,
          ledgerId: profile.eboekhouden_ledger_id,
          quantity: 1,
        });
      }

      const ebInvoice = await ebPost(session, "/invoice", {
        relationId,
        invoiceNumber: quote.quote_number || `O-${quote_id.substring(0, 8)}`,
        date: quote.issued_at || new Date().toISOString().split("T")[0],
        inExVat: "IN",
        termOfPayment: 30,
        templateId: profile.eboekhouden_template_id,
        mutation: { ledgerId: profile.eboekhouden_debtor_ledger_id || profile.eboekhouden_ledger_id },
        items: ebItems,
      });

      const ebId = String(ebInvoice.id ?? ebInvoice.Id ?? ebInvoice.invoiceId);

      return new Response(JSON.stringify({ success: true, eboekhouden_id: ebId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: update-invoice-status (REMOVED - PATCH /v1/invoice/{id} does not exist in API)
    // Payment status is now pull-only via the "pull-invoice-status" action

    // Action: sync-all-contacts
    if (action === "sync-all-contacts") {
      const { data: customers, error: custErr } = await supabase
        .from("customers")
        .select("*")
        .eq("company_id", profile.company_id);

      if (custErr) throw custErr;
      let synced = 0, skipped = 0;
      const errors: string[] = [];

      for (const cust of (customers || [])) {
        try {
          if (cust.eboekhouden_relation_id) {
            try {
              await ebPatch(session, `/relation/${cust.eboekhouden_relation_id}`, {
                name: cust.name,
                address: cust.address || "",
                postalCode: cust.postal_code || "",
                city: cust.city || "",
                emailAddress: sanitizeEmail(cust.email),
                phoneNumber: sanitizePhone(cust.phone),
              });
            } catch {
              const newRel = await ebPost(session, "/relation", {
                type: cust.type === "zakelijk" ? "B" : "P",
                name: cust.name,
                contact: cust.contact_person || "",
                address: cust.address || "",
                postalCode: cust.postal_code || "",
                city: cust.city || "",
                emailAddress: sanitizeEmail(cust.email),
                phoneNumber: sanitizePhone(cust.phone),
              });
              await supabase.from("customers").update({ eboekhouden_relation_id: newRel.id }).eq("id", cust.id);
            }
          } else {
            await ensureRelation(cust);
          }
          synced++;
        } catch (err: any) {
          errors.push(`${cust.name}: ${err.message}`);
        }
      }

      return new Response(JSON.stringify({ synced, skipped, errors }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: sync-all-invoices
    if (action === "sync-all-invoices") {
      if (!profile.eboekhouden_template_id || !profile.eboekhouden_ledger_id) {
        throw new Error("Stel eerst een factuursjabloon en grootboekrekening in via Instellingen → e-Boekhouden.");
      }

      const { data: invoices, error: invErr } = await supabase
        .from("invoices")
        .select("*, customers(id, name, type, contact_person, address, city, postal_code, email, phone, eboekhouden_relation_id), work_orders(work_order_number, services(name, price))")
        .eq("company_id", profile.company_id)
        .is("eboekhouden_id", null);

      if (invErr) throw invErr;
      let synced = 0, skipped = 0;
      const errors: string[] = [];

      for (const invoice of (invoices || [])) {
        try {
          const customer = invoice.customers as any;
          if (!customer) { skipped++; errors.push(`Factuur ${invoice.invoice_number}: geen klant`); continue; }

          const relationId = await ensureRelation(customer);

          const ebInvoice = await ebPost(session, "/invoice", {
            relationId,
            invoiceNumber: invoice.invoice_number,
            date: invoice.issued_at || new Date().toISOString().split("T")[0],
            inExVat: "IN",
            termOfPayment: calcTermOfPayment(invoice),
            templateId: profile.eboekhouden_template_id,
            mutation: { ledgerId: profile.eboekhouden_debtor_ledger_id || profile.eboekhouden_ledger_id },
            items: mapInvoiceItems(invoice, profile.eboekhouden_ledger_id),
          });

          const ebId = String(ebInvoice.id ?? ebInvoice.Id ?? ebInvoice.invoiceId);
          await supabase.from("invoices").update({ eboekhouden_id: ebId }).eq("id", invoice.id);
          synced++;
        } catch (err: any) {
          errors.push(`Factuur ${invoice.invoice_number}: ${err.message}`);
        }
      }

      return new Response(JSON.stringify({ synced, skipped, errors }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: sync single invoice
    if (action === "sync" && invoice_id) {
      if (!profile.eboekhouden_template_id || !profile.eboekhouden_ledger_id) {
        throw new Error("Stel eerst een factuursjabloon en grootboekrekening in via Instellingen → e-Boekhouden.");
      }

      const { data: invoice, error: invError } = await supabase
        .from("invoices")
        .select("*, customers(id, name, type, contact_person, address, city, postal_code, email, phone, eboekhouden_relation_id), work_orders(work_order_number, services(name, price))")
        .eq("id", invoice_id)
        .single();

      if (invError || !invoice) throw new Error("Factuur niet gevonden");
      if (invoice.eboekhouden_id) {
        return new Response(JSON.stringify({ success: true, eboekhouden_id: invoice.eboekhouden_id, message: "Al gesynchroniseerd" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const customer = invoice.customers as any;
      if (!customer) throw new Error("Geen klant gekoppeld aan factuur");

      const relationId = await ensureRelation(customer);

      const ebInvoice = await ebPost(session, "/invoice", {
        relationId,
        invoiceNumber: invoice.invoice_number,
        date: invoice.issued_at || new Date().toISOString().split("T")[0],
        inExVat: "IN",
        termOfPayment: calcTermOfPayment(invoice),
        templateId: profile.eboekhouden_template_id,
        mutation: { ledgerId: profile.eboekhouden_debtor_ledger_id || profile.eboekhouden_ledger_id },
        items: mapInvoiceItems(invoice, profile.eboekhouden_ledger_id),
      });

      const ebId = String(ebInvoice.id ?? ebInvoice.Id ?? ebInvoice.invoiceId);
      await supabase.from("invoices").update({ eboekhouden_id: ebId }).eq("id", invoice_id);

      return new Response(JSON.stringify({ success: true, eboekhouden_id: ebId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: pull-contacts
    if (action === "pull-contacts") {
      let allRelations: any[] = [];
      let offset = 0;
      const limit = 2000;
      while (true) {
        const raw = await ebGet(session, `/relation?limit=${limit}&offset=${offset}`);
        const items = raw?.items ?? (Array.isArray(raw) ? raw : []);
        allRelations = allRelations.concat(items);
        if (items.length < limit) break;
        offset += limit;
      }

      let updated = 0, created = 0;
      const errors: string[] = [];

      for (const rel of allRelations) {
        try {
          const detail = await ebGet(session, `/relation/${rel.id}`);

          const customerData = {
            name: detail.name || detail.contact || `Relatie ${rel.id}`,
            address: detail.address || null,
            postal_code: detail.postalCode || null,
            city: detail.city || null,
            email: sanitizeEmail(detail.emailAddress) || null,
            phone: sanitizePhone(detail.phoneNumber) || null,
            eboekhouden_relation_id: rel.id,
          };

          const { data: existing } = await supabase
            .from("customers")
            .select("id")
            .eq("eboekhouden_relation_id", rel.id)
            .eq("company_id", profile.company_id)
            .maybeSingle();

          if (existing) {
            await supabase
              .from("customers")
              .update(customerData)
              .eq("id", existing.id);
            updated++;
          } else {
            await supabase
              .from("customers")
              .insert({ ...customerData, company_id: profile.company_id });
            created++;
          }
        } catch (err: any) {
          errors.push(`Relatie ${rel.id}: ${err.message}`);
        }
      }

      return new Response(JSON.stringify({ updated, created, total: allRelations.length, errors }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: pull-invoices
    if (action === "pull-invoices") {
      let allInvoices: any[] = [];
      let offset = 0;
      const limit = 2000;
      while (true) {
        const raw = await ebGet(session, `/invoice?limit=${limit}&offset=${offset}`);
        const items = raw?.items ?? (Array.isArray(raw) ? raw : []);
        allInvoices = allInvoices.concat(items);
        if (items.length < limit) break;
        offset += limit;
      }

      const { data: existingInvoices } = await supabase
        .from("invoices")
        .select("eboekhouden_id")
        .eq("company_id", profile.company_id)
        .not("eboekhouden_id", "is", null);

      const existingIds = new Set((existingInvoices || []).map((i: any) => String(i.eboekhouden_id)));

      const notImported = allInvoices.filter((inv: any) => !existingIds.has(String(inv.id)));

      let imported = 0, skippedNoCustomer = 0;
      const importErrors: string[] = [];
      const skippedInvoices: any[] = [];

      for (const ebInv of notImported) {
        try {
          const { data: customer } = await supabase
            .from("customers")
            .select("id")
            .eq("eboekhouden_relation_id", ebInv.relationId)
            .eq("company_id", profile.company_id)
            .maybeSingle();

          if (!customer) {
            skippedNoCustomer++;
            skippedInvoices.push({
              id: ebInv.id,
              invoiceNumber: ebInv.invoiceNumber,
              relationId: ebInv.relationId,
              reason: "Geen klant gevonden",
            });
            continue;
          }

          const subtotal = Number(ebInv.totalExcl || 0);
          const total = Number(ebInv.totalAmount || ebInv.totalIncl || 0);
          const vatAmount = Number(ebInv.vatAmount || (total - subtotal));

          await supabase.from("invoices").insert({
            customer_id: customer.id,
            company_id: profile.company_id,
            eboekhouden_id: String(ebInv.id),
            invoice_number: ebInv.invoiceNumber || null,
            subtotal,
            total,
            vat_amount: vatAmount,
            status: "verzonden",
            issued_at: ebInv.date || null,
          });

          imported++;
        } catch (err: any) {
          importErrors.push(`Factuur ${ebInv.invoiceNumber || ebInv.id}: ${err.message}`);
        }
      }

      return new Response(JSON.stringify({
        total_in_eboekhouden: allInvoices.length,
        already_imported: allInvoices.length - notImported.length,
        imported,
        skipped_no_customer: skippedNoCustomer,
        skipped_invoices: skippedInvoices,
        errors: importErrors,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: pull-invoice-status
    if (action === "pull-invoice-status") {
      const { data: unpaidInvoices } = await supabase
        .from("invoices")
        .select("id, eboekhouden_id, invoice_number, status")
        .eq("company_id", profile.company_id)
        .not("eboekhouden_id", "is", null)
        .neq("status", "betaald");

      if (!unpaidInvoices || unpaidInvoices.length === 0) {
        return new Response(JSON.stringify({ checked: 0, updated: 0, errors: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch outstanding invoices from e-Boekhouden for reliable paid detection
      let outstandingIds: Set<string> = new Set();
      try {
        let offset = 0;
        const limit = 500;
        while (true) {
          const batch: any = await ebGet(session, `/mutation/invoice/outstanding?limit=${limit}&offset=${offset}`);
          const items = batch?.items || batch || [];
          if (!Array.isArray(items) || items.length === 0) break;
          for (const item of items) {
            if (item.invoiceNumber) outstandingIds.add(String(item.invoiceNumber));
          }
          if (items.length < limit) break;
          offset += limit;
        }
      } catch (err: any) {
        console.warn("Could not fetch outstanding invoices, falling back to per-invoice check:", err.message);
      }

      let updated = 0;
      const errors: string[] = [];

      for (const inv of unpaidInvoices) {
        try {
          // If we have the outstanding list, use it for reliable detection
          if (outstandingIds.size > 0) {
            const ebInv = await ebGet(session, `/invoice/${inv.eboekhouden_id}`);
            const ebInvoiceNumber = ebInv.invoiceNumber || "";
            if (!outstandingIds.has(String(ebInvoiceNumber))) {
              // Not in outstanding list = paid
              await supabase
                .from("invoices")
                .update({ status: "betaald", paid_at: ebInv.paymentDate || new Date().toISOString().split("T")[0] })
                .eq("id", inv.id);
              updated++;
            }
          } else {
            // Fallback: check paymentDate on individual invoice
            const ebInv = await ebGet(session, `/invoice/${inv.eboekhouden_id}`);
            if (ebInv.paymentDate) {
              await supabase
                .from("invoices")
                .update({ status: "betaald", paid_at: ebInv.paymentDate })
                .eq("id", inv.id);
              updated++;
            }
          }
        } catch (err: any) {
          errors.push(`Factuur ${inv.eboekhouden_id}: ${err.message}`);
        }
      }

      return new Response(JSON.stringify({ checked: unpaidInvoices.length, updated, errors }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: create-invoice (push single invoice at creation, like Rompslomp/Moneybird)
    if (action === "create-invoice") {
      if (!invoice_id) throw new Error("invoice_id is verplicht");
      if (!profile.eboekhouden_template_id || !profile.eboekhouden_ledger_id) {
        throw new Error("Stel eerst een factuursjabloon en grootboekrekening in via Instellingen → e-Boekhouden.");
      }

      const { data: invoice, error: invError } = await supabase
        .from("invoices")
        .select("*, customers(id, name, type, contact_person, address, city, postal_code, email, phone, eboekhouden_relation_id), work_orders(work_order_number, services(name, price))")
        .eq("id", invoice_id)
        .single();
      if (invError || !invoice) throw new Error("Factuur niet gevonden");
      if (invoice.eboekhouden_id) {
        return new Response(JSON.stringify({ success: true, eboekhouden_id: invoice.eboekhouden_id, message: "Al gesynchroniseerd" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const customer = invoice.customers as any;
      if (!customer) throw new Error("Geen klant gekoppeld aan factuur");

      const relationId = await ensureRelation(customer);

      const ebInvoice = await ebPost(session, "/invoice", {
        relationId,
        invoiceNumber: invoice.invoice_number,
        date: invoice.issued_at || new Date().toISOString().split("T")[0],
        inExVat: "IN",
        termOfPayment: calcTermOfPayment(invoice),
        templateId: profile.eboekhouden_template_id,
        mutation: { ledgerId: profile.eboekhouden_debtor_ledger_id || profile.eboekhouden_ledger_id },
        items: mapInvoiceItems(invoice, profile.eboekhouden_ledger_id),
      });

      const ebId = String(ebInvoice.id ?? ebInvoice.Id ?? ebInvoice.invoiceId);
      await supabase.from("invoices").update({ eboekhouden_id: ebId, status: "verzonden" }).eq("id", invoice_id);

      return new Response(JSON.stringify({ success: true, eboekhouden_id: ebId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: create-quote (push single quote at creation)
    if (action === "create-quote") {
      if (!quote_id) throw new Error("quote_id is verplicht");
      if (!profile.eboekhouden_template_id || !profile.eboekhouden_ledger_id) {
        throw new Error("Stel eerst een factuursjabloon en grootboekrekening in via Instellingen → e-Boekhouden.");
      }

      const { data: quote, error: qErr } = await supabase
        .from("quotes")
        .select("*, customers(id, name, type, contact_person, address, city, postal_code, email, phone, eboekhouden_relation_id)")
        .eq("id", quote_id)
        .single();
      if (qErr || !quote) throw new Error("Offerte niet gevonden");

      const customer = quote.customers as any;
      if (!customer) throw new Error("Geen klant gekoppeld aan offerte");

      const relationId = await ensureRelation(customer);

      const items = Array.isArray(quote.items) ? quote.items : [];
      const quoteVatCode = eboekhoudenVatCode(Number(quote.vat_percentage || 21));
      const ebItems = items.map((item: any) => ({
        description: item.description || "Offerte item",
        pricePerUnit: Number(item.unit_price || 0),
        vatCode: quoteVatCode,
        ledgerId: profile.eboekhouden_ledger_id,
        quantity: Number(item.qty || 1),
      }));

      if (ebItems.length === 0) {
        ebItems.push({
          description: "Offerte",
          pricePerUnit: Number(quote.total || 0),
          vatCode: quoteVatCode,
          ledgerId: profile.eboekhouden_ledger_id,
          quantity: 1,
        });
      }

      const ebInvoice = await ebPost(session, "/invoice", {
        relationId,
        invoiceNumber: quote.quote_number || `O-${quote_id.substring(0, 8)}`,
        date: quote.issued_at || new Date().toISOString().split("T")[0],
        inExVat: "IN",
        termOfPayment: 30,
        templateId: profile.eboekhouden_template_id,
        mutation: { ledgerId: profile.eboekhouden_debtor_ledger_id || profile.eboekhouden_ledger_id },
        items: ebItems,
      });

      const ebId = String(ebInvoice.id ?? ebInvoice.Id ?? ebInvoice.invoiceId);

      return new Response(JSON.stringify({ success: true, eboekhouden_id: ebId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Onbekende actie");
  } catch (err: any) {
    if (err instanceof RateLimitError) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.error("sync-invoice-eboekhouden error:", err);
    // Only expose known user-facing messages, not internal details
    const safeMessages = [
      "Niet geautoriseerd", "e-Boekhouden API-token niet ingesteld",
      "Klant niet gevonden", "Factuur niet gevonden", "Offerte niet gevonden",
      "Geen klant gekoppeld", "Stel eerst een factuursjabloon", "Onbekende actie",
      "e-Boekhouden relatie", "Relatie kon niet worden",
      "MUT_", "INV_", "REL_", "e-Boekhouden POST", "e-Boekhouden PATCH",
      "Stel eerst een debiteurenrekening",
    ];
    const isSafe = safeMessages.some(m => err.message?.includes(m));
    return new Response(JSON.stringify({ error: isSafe ? err.message : "Er is een fout opgetreden bij de synchronisatie", code: "SYNC_ERROR" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
