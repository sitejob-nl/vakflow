import { corsHeaders, jsonRes, optionsResponse } from "../_shared/cors.ts";
import { createAdminClient, authenticateRequest, AuthError } from "../_shared/supabase.ts";
import { decrypt } from "../_shared/crypto.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { logEdgeFunctionError } from "../_shared/error-logger.ts";

const ROMPSLOMP_BASE = "https://api.rompslomp.nl/api/v1";

/** Resolve per-tenant Rompslomp credentials */
async function getTenantConfig(companyId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("companies")
    .select("rompslomp_company_id, rompslomp_api_token")
    .eq("id", companyId)
    .single();

  if (error || !data) throw new Error("Bedrijfsconfiguratie niet gevonden");
  if (!data.rompslomp_company_id) throw new Error("Rompslomp bedrijfs-ID niet ingesteld");
  if (!data.rompslomp_api_token) throw new Error("Rompslomp API-token niet ingesteld");

  const token = await decrypt(data.rompslomp_api_token);
  return { rompslompCompanyId: data.rompslomp_company_id, token };
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const chunkSize = 8192;
  let bin = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, i + chunkSize);
    bin += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(bin);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  try {
    // Auth
    const { userId, companyId } = await authenticateRequest(req);

    // Rate limit
    const admin = createAdminClient();
    await checkRateLimit(admin, companyId, "rompslomp_api", 60, 60);

    const { action, data } = await req.json();
    console.log("rompslomp-api:", { action, companyId });

    const { rompslompCompanyId, token } = await getTenantConfig(companyId);

    // PDF helpers — early return
    if (action === "get_invoice_pdf" || action === "get_quotation_pdf") {
      const resource = action === "get_invoice_pdf" ? "sales_invoices" : "quotations";
      const id = action === "get_invoice_pdf" ? data?.invoiceId : data?.quotationId;
      if (!id) return jsonRes({ error: "ID is verplicht" }, 400, corsHeaders);

      const url = `${ROMPSLOMP_BASE}/companies/${rompslompCompanyId}/${resource}/${id}/pdf`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return jsonRes({ error: "PDF ophalen mislukt" }, res.status, corsHeaders);

      const pdf = arrayBufferToBase64(await res.arrayBuffer());
      return jsonRes({ pdf, contentType: "application/pdf" }, 200, corsHeaders);
    }

    // Build endpoint + method + body
    let endpoint = "";
    let method = "GET";
    let body: string | null = null;
    const base = `/companies/${rompslompCompanyId}`;

    switch (action) {
      // --- Contacts ---
      case "list_contacts":
        endpoint = `${base}/contacts`;
        break;
      case "search_contact": {
        const params = new URLSearchParams();
        if (data?.query) params.set("search[q]", data.query);
        endpoint = `${base}/contacts${params.toString() ? `?${params}` : ""}`;
        break;
      }
      case "create_contact":
        if (!data?.contact) return jsonRes({ error: "Contact data verplicht" }, 400, corsHeaders);
        endpoint = `${base}/contacts`;
        method = "POST";
        body = JSON.stringify({ contact: data.contact });
        break;
      case "update_contact":
        if (!data?.contactId || !data?.contact) return jsonRes({ error: "Contact ID en data verplicht" }, 400, corsHeaders);
        endpoint = `${base}/contacts/${data.contactId}`;
        method = "PATCH";
        body = JSON.stringify({ contact: data.contact });
        break;

      // --- Invoices ---
      case "list_invoices": {
        const p = new URLSearchParams();
        if (data?.selection) p.set("selection", data.selection);
        if (data?.from) p.set("search[from]", data.from);
        if (data?.till) p.set("search[till]", data.till);
        if (data?.per_page) p.set("per_page", data.per_page.toString());
        endpoint = `${base}/sales_invoices${p.toString() ? `?${p}` : ""}`;
        break;
      }
      case "get_invoice":
        if (!data?.invoiceId) return jsonRes({ error: "Invoice ID verplicht" }, 400, corsHeaders);
        endpoint = `${base}/sales_invoices/${data.invoiceId}`;
        break;
      case "create_invoice":
        if (!data?.invoice) return jsonRes({ error: "Factuurdata verplicht" }, 400, corsHeaders);
        endpoint = `${base}/sales_invoices`;
        method = "POST";
        body = JSON.stringify({ sales_invoice: data.invoice });
        break;
      case "update_invoice":
        if (!data?.invoiceId || !data?.invoice) return jsonRes({ error: "Invoice ID en data verplicht" }, 400, corsHeaders);
        endpoint = `${base}/sales_invoices/${data.invoiceId}`;
        method = "PATCH";
        body = JSON.stringify({ sales_invoice: data.invoice });
        break;
      case "delete_invoice":
        if (!data?.invoiceId) return jsonRes({ error: "Invoice ID verplicht" }, 400, corsHeaders);
        endpoint = `${base}/sales_invoices/${data.invoiceId}`;
        method = "DELETE";
        break;

      // --- Quotations ---
      case "list_quotations": {
        const q = new URLSearchParams();
        if (data?.selection) q.set("selection", data.selection);
        if (data?.from) q.set("search[from]", data.from);
        if (data?.till) q.set("search[till]", data.till);
        if (data?.contact_id) q.set("search[contact_id]", data.contact_id.toString());
        if (data?.per_page) q.set("per_page", data.per_page.toString());
        endpoint = `${base}/quotations${q.toString() ? `?${q}` : ""}`;
        break;
      }
      case "get_quotation":
        if (!data?.quotationId) return jsonRes({ error: "Quotation ID verplicht" }, 400, corsHeaders);
        endpoint = `${base}/quotations/${data.quotationId}`;
        break;
      case "create_quotation":
        if (!data?.quotation) return jsonRes({ error: "Offertedata verplicht" }, 400, corsHeaders);
        endpoint = `${base}/quotations`;
        method = "POST";
        body = JSON.stringify({ quotation: data.quotation });
        break;
      case "update_quotation":
        if (!data?.quotationId || !data?.quotation) return jsonRes({ error: "Quotation ID en data verplicht" }, 400, corsHeaders);
        endpoint = `${base}/quotations/${data.quotationId}`;
        method = "PATCH";
        body = JSON.stringify({ quotation: data.quotation });
        break;
      case "delete_quotation":
        if (!data?.quotationId) return jsonRes({ error: "Quotation ID verplicht" }, 400, corsHeaders);
        endpoint = `${base}/quotations/${data.quotationId}`;
        method = "DELETE";
        break;

      // --- Products ---
      case "list_products":
        endpoint = `${base}/products`;
        break;
      case "create_product":
        if (!data?.product) return jsonRes({ error: "Productdata verplicht" }, 400, corsHeaders);
        endpoint = `${base}/products`;
        method = "POST";
        body = JSON.stringify({ product: data.product });
        break;
      case "update_product":
        if (!data?.productId || !data?.product) return jsonRes({ error: "Product ID en data verplicht" }, 400, corsHeaders);
        endpoint = `${base}/products/${data.productId}`;
        method = "PATCH";
        body = JSON.stringify({ product: data.product });
        break;
      case "delete_product":
        if (!data?.productId) return jsonRes({ error: "Product ID verplicht" }, 400, corsHeaders);
        endpoint = `${base}/products/${data.productId}`;
        method = "DELETE";
        break;

      default:
        return jsonRes({ error: `Onbekende actie: ${action}` }, 400, corsHeaders);
    }

    // Execute request
    const url = `${ROMPSLOMP_BASE}${endpoint}`;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body,
    });

    if (res.status === 429) {
      const retryAfter = res.headers.get("Retry-After") || "60";
      return jsonRes({ error: "Rate limit overschreden", retryAfter: parseInt(retryAfter) }, 429, corsHeaders);
    }

    if (res.status === 204) {
      return jsonRes({ success: true }, 200, corsHeaders);
    }

    const responseData = await res.json();
    if (!res.ok) {
      console.error("Rompslomp API error:", responseData);
      return jsonRes({
        error: responseData.error?.message || "Rompslomp API fout",
        type: responseData.error?.type,
      }, res.status, corsHeaders);
    }

    return jsonRes(responseData, 200, corsHeaders);
  } catch (err) {
    if (err instanceof AuthError) return jsonRes({ error: err.message }, err.status, corsHeaders);
    if (err instanceof RateLimitError) return jsonRes({ error: err.message }, 429, corsHeaders);
    console.error("rompslomp-api error:", err);
    await logEdgeFunctionError("rompslomp-api", err instanceof Error ? err.message : String(err), { stack: err instanceof Error ? err.stack : undefined });
    return jsonRes({ error: err instanceof Error ? err.message : "Onbekende fout" }, 500, corsHeaders);
  }
});
