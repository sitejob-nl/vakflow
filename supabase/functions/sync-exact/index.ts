import { jsonRes, optionsResponse } from "../_shared/cors.ts";
import { createAdminClient, authenticateRequest, AuthError } from "../_shared/supabase.ts";
import { logUsage } from "../_shared/usage.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { logEdgeFunctionError } from "../_shared/error-logger.ts";

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseODataDate(val: unknown): string | null {
  if (!val) return null;
  const s = String(val);
  const match = s.match(/\/Date\((\d+)\)\//);
  if (match) return new Date(Number(match[1])).toISOString().split("T")[0];
  if (s.includes("T")) return s.split("T")[0];
  return s;
}

function cleanBody(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined));
}

function mapVatCode(vatPct: number, config: any): string {
  if (vatPct === 0) return config.vat_code_zero || "VN";
  if (vatPct === 9) return config.vat_code_low || "VL";
  return config.vat_code_high || "VH";
}

function calcPaymentCondition(issuedAt: string | null, dueAt: string | null, configDefault: string | null): string | undefined {
  if (configDefault) return configDefault;
  if (issuedAt && dueAt) {
    const days = Math.round((new Date(dueAt).getTime() - new Date(issuedAt).getTime()) / 86400000);
    if (days > 0) return String(days);
  }
  return undefined;
}

// ─── Token management ───────────────────────────────────────────────────────

interface ExactToken { access_token: string; division: number; region: string; base_url: string; expires_at: string; }

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

// ─── Rate-limit-aware API (#7) ──────────────────────────────────────────────

const rl = { minutelyRemaining: 60, dailyRemaining: 5000 };

function readRL(res: Response) {
  const mr = res.headers.get("X-RateLimit-Minutely-Remaining");
  const dr = res.headers.get("X-RateLimit-Remaining");
  if (mr !== null) rl.minutelyRemaining = Number(mr);
  if (dr !== null) rl.dailyRemaining = Number(dr);
}

async function rlPause() {
  if (rl.minutelyRemaining < 3) {
    console.warn("sync-exact: minutely rate limit low, pausing 10s");
    await new Promise((r) => setTimeout(r, 10_000));
  }
}

async function exactGetAll(baseUrl: string, division: number, endpoint: string, token: string, params = ""): Promise<any[]> {
  let all: any[] = [];
  let url: string | null = `${baseUrl}/api/v1/${division}/${endpoint}${params ? "?" + params : ""}`;
  while (url) {
    await rlPause();
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    readRL(res);
    if (res.status === 429) { await new Promise((r) => setTimeout(r, 5000)); continue; }
    if (!res.ok) { const t = await res.text(); throw new Error(`Exact API ${res.status}: ${t.slice(0, 200)}`); }
    const data = await res.json();
    const results = data.d?.results || (Array.isArray(data.d) ? data.d : data.d ? [data.d] : []);
    all.push(...results);
    url = data.d?.__next || null;
  }
  return all;
}

async function exactRequest(url: string, token: string, method: "POST" | "PUT", body: Record<string, unknown>): Promise<{ ok: boolean; data?: any; error?: string; status: number }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    await rlPause();
    const res = await fetch(url, {
      method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    readRL(res);
    if (res.status === 429) { await new Promise((r) => setTimeout(r, 3000 * (attempt + 1))); continue; }
    if (!res.ok) {
      const errText = await res.text();
      let errorDetail = errText.slice(0, 500);
      try { const j = JSON.parse(errText); const m = j?.error?.message?.value || j?.error?.message || j?.error?.innererror?.message; if (m) errorDetail = m; } catch {}
      console.error(`Exact ${method} ${url} → ${res.status}: ${errorDetail}`);
      return { ok: false, error: errorDetail.slice(0, 300), status: res.status };
    }
    const data = await res.json().catch(() => ({}));
    return { ok: true, data: data.d || data, status: res.status };
  }
  return { ok: false, error: "Rate limit exceeded after retries", status: 429 };
}

const exactPost = (url: string, token: string, body: Record<string, unknown>) => exactRequest(url, token, "POST", body);
const exactPut = (url: string, token: string, body: Record<string, unknown>) => exactRequest(url, token, "PUT", body);

// ─── Contact dedup (#10) ────────────────────────────────────────────────────

async function findExistingExactAccount(baseUrl: string, division: number, token: string, customer: any): Promise<string | null> {
  if (customer.kvk_number) {
    const r = await exactGetAll(baseUrl, division, "crm/Accounts", token, `$select=ID&$filter=ChamberOfCommerce eq '${customer.kvk_number}'&$top=1`);
    if (r.length > 0) return r[0].ID;
  }
  if (customer.btw_number) {
    const r = await exactGetAll(baseUrl, division, "crm/Accounts", token, `$select=ID&$filter=VATNumber eq '${customer.btw_number}'&$top=1`);
    if (r.length > 0) return r[0].ID;
  }
  return null;
}

async function ensureExactAccount(sb: any, baseUrl: string, division: number, token: string, customer: any): Promise<string | null> {
  if (customer.exact_account_id) return customer.exact_account_id;
  const existingId = await findExistingExactAccount(baseUrl, division, token, customer);
  if (existingId) { await sb.from("customers").update({ exact_account_id: existingId }).eq("id", customer.id); return existingId; }
  const accountData = cleanBody({
    Name: (customer.name || "").slice(0, 50), Status: "C", Country: "NL", IsSales: true,
    Email: customer.email || undefined, Phone: customer.phone || undefined,
    City: customer.city || undefined, Postcode: customer.postal_code || undefined,
    AddressLine1: customer.address || undefined,
    ...(customer.kvk_number ? { ChamberOfCommerce: customer.kvk_number } : {}),
    ...(customer.btw_number ? { VATNumber: customer.btw_number } : {}),
  });
  const result = await exactPost(`${baseUrl}/api/v1/${division}/crm/Accounts`, token, accountData);
  if (!result.ok) return null;
  const id = result.data?.ID;
  if (id) await sb.from("customers").update({ exact_account_id: id }).eq("id", customer.id);
  return id || null;
}

// ─── Invoice/quote line builders (#2 #3) ────────────────────────────────────

function buildInvoiceLines(items: any[], vatPct: number, config: any) {
  const div = 1 + vatPct / 100;
  const vc = mapVatCode(vatPct, config);
  return items.map((item: any) => ({
    Description: item.description || item.name || "Regel",
    Quantity: item.qty || item.quantity || 1,
    UnitPrice: Math.round(Number(item.unit_price || item.price || 0) / div * 100) / 100,
    VATCode: vc,
    GLAccount: config.gl_revenue_id,
  }));
}

function buildQuotationLines(items: any[], vatPct: number, config: any) {
  const div = 1 + vatPct / 100;
  const vc = mapVatCode(vatPct, config);
  return items.map((item: any) => ({
    Description: item.description || item.name || "Regel",
    Quantity: item.qty || item.quantity || 1,
    UnitPrice: Math.round(Number(item.unit_price || item.price || 0) / div * 100) / 100,
    VATCode: vc,
  }));
}

// ─── Finalize invoice (#5) ──────────────────────────────────────────────────

async function finalizeInvoice(baseUrl: string, division: number, token: string, invoiceId: string) {
  const r = await exactPost(`${baseUrl}/api/v1/${division}/salesinvoice/PrintedSalesInvoices`, token, { InvoiceID: invoiceId });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, invoiceNumber: r.data?.InvoiceNumber ? String(r.data.InvoiceNumber) : undefined };
}

// ─── Main ───────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  try {
    const { companyId } = await authenticateRequest(req);
    const sb = createAdminClient();
    await checkRateLimit(sb, companyId, "sync_exact", 5);

    const { data: config } = await sb.from("exact_config").select("*").eq("company_id", companyId).maybeSingle();
    if (!config?.tenant_id || !config?.webhook_secret) return jsonRes({ error: "Exact Online is niet gekoppeld" }, 400);

    const body = await req.json();
    const { action } = body;

    let tokenData: ExactToken;
    try { tokenData = await getExactToken(config.tenant_id, config.webhook_secret); }
    catch (err: any) {
      if (err.message === "REAUTH_REQUIRED" || err.message?.includes("Tenant not active")) {
        await sb.from("exact_config").update({ status: "error", updated_at: new Date().toISOString() }).eq("company_id", companyId);
        return jsonRes({ error: "Exact Online koppeling niet actief. Koppel opnieuw.", needs_reauth: true }, 401);
      }
      throw err;
    }
    const { access_token, division, base_url } = tokenData;

    switch (action) {

    case "test": {
      const r = await fetch(`${base_url}/api/v1/current/Me?$select=CurrentDivision,FullName`, { headers: { Authorization: `Bearer ${access_token}`, Accept: "application/json" } });
      if (!r.ok) return jsonRes({ error: `Exact API ${r.status}` }, 500);
      const d = await r.json(); const me = d.d?.results?.[0] || d.d;
      return jsonRes({ ok: true, user: me?.FullName || "Connected", division, rate_limit: rl });
    }

    case "discover-divisions": {
      const divs = await exactGetAll(base_url, division, "system/Divisions", access_token, "$select=Code,Description,HID,Status");
      return jsonRes({ divisions: divs.map((d: any) => ({ code: d.Code, name: d.Description, hid: d.HID, status: d.Status })) });
    }

    case "fetch-gl-accounts": {
      const accs = await exactGetAll(base_url, division, "financial/GLAccounts", access_token, "$select=ID,Code,Description&$filter=Type eq 110&$orderby=Code");
      return jsonRes({ accounts: accs.map((a: any) => ({ id: a.ID, code: a.Code, description: a.Description })) });
    }

    case "fetch-vat-codes": {
      const codes = await exactGetAll(base_url, division, "vat/VATCodes", access_token, "$select=Code,Description,Percentage,Type&$orderby=Code");
      return jsonRes({ vat_codes: codes.map((c: any) => ({ code: c.Code, description: c.Description, percentage: c.Percentage, type: c.Type })) });
    }

    case "fetch-payment-conditions": {
      const conds = await exactGetAll(base_url, division, "cashflow/PaymentConditions", access_token, "$select=Code,Description&$orderby=Code");
      return jsonRes({ payment_conditions: conds.map((c: any) => ({ code: c.Code, description: c.Description })) });
    }

    case "sync-contacts": {
      const { data: newC } = await sb.from("customers").select("*").eq("company_id", companyId).is("exact_account_id", null);
      const { data: existC } = await sb.from("customers").select("*").eq("company_id", companyId).not("exact_account_id", "is", null);
      let synced = 0, updated = 0, skipped = 0; const errors: string[] = [];
      for (const c of newC || []) {
        try { const id = await ensureExactAccount(sb, base_url, division, access_token, c); if (id) synced++; else { skipped++; errors.push(`${c.name}: kon niet aanmaken`); } }
        catch (e: any) { errors.push(`${c.name}: ${e.message}`); }
      }
      for (const c of existC || []) {
        try {
          const d = cleanBody({ Name: (c.name||"").slice(0,50), Email: c.email||undefined, Phone: c.phone||undefined, City: c.city||undefined, Postcode: c.postal_code||undefined, AddressLine1: c.address||undefined, ...(c.kvk_number?{ChamberOfCommerce:c.kvk_number}:{}), ...(c.btw_number?{VATNumber:c.btw_number}:{}) });
          const r = await exactPut(`${base_url}/api/v1/${division}/crm/Accounts(guid'${c.exact_account_id}')`, access_token, d);
          if (r.ok) updated++; else errors.push(`Update ${c.name}: ${r.error}`);
        } catch (e: any) { errors.push(`Update ${c.name}: ${e.message}`); }
      }
      await logUsage(sb, companyId, "exact_sync_contacts", { synced, updated, skipped, errors: errors.length });
      return jsonRes({ synced, updated, skipped, errors });
    }

    case "pull-contacts": {
      const accs = await exactGetAll(base_url, division, "crm/Accounts", access_token, "$select=ID,Name,Email,Phone,City,Postcode,AddressLine1,ChamberOfCommerce,VATNumber&$filter=Status eq 'C'");
      let imported = 0, already = 0; const errors: string[] = [];
      for (const a of accs) {
        try {
          const { data: exi } = await sb.from("customers").select("id").eq("company_id", companyId).eq("exact_account_id", a.ID).maybeSingle();
          if (exi) { already++; continue; }
          const { data: byName } = await sb.from("customers").select("id").eq("company_id", companyId).eq("name", a.Name).maybeSingle();
          if (byName) { await sb.from("customers").update({ exact_account_id: a.ID }).eq("id", byName.id); already++; continue; }
          await sb.from("customers").insert({ company_id: companyId, name: a.Name, email: a.Email||null, phone: a.Phone||null, city: a.City||null, postal_code: a.Postcode||null, address: a.AddressLine1||null, exact_account_id: a.ID, kvk_number: a.ChamberOfCommerce||null, btw_number: a.VATNumber||null });
          imported++;
        } catch (e: any) { errors.push(`${a.Name}: ${e.message}`); }
      }
      await logUsage(sb, companyId, "exact_pull_contacts", { imported, already, errors: errors.length });
      return jsonRes({ total_in_exact: accs.length, already_imported: already, imported, errors });
    }

    case "sync-single-contact": {
      const { customer_id } = body;
      if (!customer_id) return jsonRes({ error: "customer_id is verplicht" }, 400);
      const { data: c } = await sb.from("customers").select("*").eq("id", customer_id).eq("company_id", companyId).single();
      if (!c) return jsonRes({ error: "Klant niet gevonden" }, 404);
      const id = await ensureExactAccount(sb, base_url, division, access_token, c);
      if (!id) return jsonRes({ error: "Kon klant niet aanmaken in Exact" }, 500);
      return jsonRes({ success: true, exact_account_id: id });
    }

    case "sync-invoices": {
      if (!config.gl_revenue_id) return jsonRes({ error: "Stel eerst een omzet-grootboekrekening in via Instellingen > Boekhouding" }, 400);
      const yr = new Date().getFullYear();
      const { data: invoices } = await sb.from("invoices")
        .select("*, customers(id, name, email, exact_account_id, phone, city, postal_code, address, kvk_number, btw_number)")
        .eq("company_id", companyId).in("status", ["verzonden", "verstuurd"]).is("exact_id", null).gte("issued_at", `${yr}-01-01`);
      if (!invoices?.length) return jsonRes({ synced: 0, skipped: 0, finalized: 0, errors: [] });

      let autoSynced = 0; const seen = new Set<string>();
      for (const inv of invoices) {
        const cu = inv.customers as any;
        if (!cu?.exact_account_id && cu?.id && !seen.has(cu.id)) {
          seen.add(cu.id);
          const nid = await ensureExactAccount(sb, base_url, division, access_token, cu);
          if (nid) { cu.exact_account_id = nid; autoSynced++; }
        }
      }

      let synced = 0, skipped = 0, finalized = 0; const errors: string[] = [];
      for (const inv of invoices) {
        try {
          const cu = inv.customers as any;
          if (!cu?.exact_account_id) { skipped++; errors.push(`${inv.invoice_number}: Klant niet in Exact`); continue; }
          const vp = Number(inv.vat_percentage || 21);
          const lines = buildInvoiceLines((inv.items as any[]) || [], vp, config);
          if (!lines.length) { skipped++; errors.push(`${inv.invoice_number}: Geen regels`); continue; }
          const pc = calcPaymentCondition(inv.issued_at, inv.due_at, config.payment_condition);
          const d: Record<string, unknown> = {
            Journal: config.journal_code || "70", Type: config.invoice_type || 8020,
            OrderedBy: cu.exact_account_id, Description: `Factuur ${inv.invoice_number || ""}`.trim(),
            InvoiceDate: inv.issued_at || new Date().toISOString().split("T")[0], SalesInvoiceLines: lines,
          };
          if (pc) d.PaymentCondition = pc;
          if (inv.due_at) d.DueDate = inv.due_at;

          const r = await exactPost(`${base_url}/api/v1/${division}/salesinvoice/SalesInvoices`, access_token, d);
          if (!r.ok) { errors.push(`${inv.invoice_number}: ${r.error}`); await logEdgeFunctionError(sb, "sync-exact", `Invoice ${inv.invoice_number} failed: ${r.error}`, { invoice_id: inv.id }); continue; }

          const eid = r.data?.InvoiceID;
          const upd: Record<string, any> = { exact_id: eid };
          if (config.auto_finalize && eid) {
            const fin = await finalizeInvoice(base_url, division, access_token, eid);
            if (fin.ok) { finalized++; if (fin.invoiceNumber) upd.invoice_number = fin.invoiceNumber; }
            else errors.push(`${inv.invoice_number}: finalize: ${fin.error}`);
          }
          if (eid) await sb.from("invoices").update(upd).eq("id", inv.id);
          synced++;
        } catch (e: any) { errors.push(`${inv.invoice_number}: ${e.message}`); await logEdgeFunctionError(sb, "sync-exact", `Invoice ${inv.invoice_number} exc: ${e.message}`, { invoice_id: inv.id }); }
      }
      await logUsage(sb, companyId, "exact_sync_invoices", { synced, skipped, finalized, errors: errors.length, auto_synced_customers: autoSynced });
      return jsonRes({ synced, skipped, finalized, errors, auto_synced_customers: autoSynced });
    }

    case "create-invoice": {
      const { invoice_id } = body;
      if (!invoice_id) return jsonRes({ error: "invoice_id is required" }, 400);
      if (!config.gl_revenue_id) return jsonRes({ error: "Stel eerst een omzet-grootboekrekening in" }, 400);
      const { data: inv } = await sb.from("invoices").select("*, customers(*)").eq("id", invoice_id).eq("company_id", companyId).single();
      if (!inv) return jsonRes({ error: "Factuur niet gevonden" }, 404);
      if (inv.exact_id) return jsonRes({ error: "Al gesynchroniseerd", exact_id: inv.exact_id }, 400);
      const cu = inv.customers as any;
      const aid = await ensureExactAccount(sb, base_url, division, access_token, cu);
      if (!aid) return jsonRes({ error: "Klant kon niet naar Exact" }, 500);
      const vp = Number(inv.vat_percentage || 21);
      const lines = buildInvoiceLines((inv.items as any[]) || [], vp, config);
      if (!lines.length) return jsonRes({ error: "Geen factuurregels" }, 400);
      const pc = calcPaymentCondition(inv.issued_at, inv.due_at, config.payment_condition);
      const d: Record<string, unknown> = {
        Journal: config.journal_code || "70", Type: config.invoice_type || 8020,
        OrderedBy: aid, Description: `Factuur ${inv.invoice_number || ""}`.trim(),
        InvoiceDate: inv.issued_at || new Date().toISOString().split("T")[0], SalesInvoiceLines: lines,
      };
      if (pc) d.PaymentCondition = pc; if (inv.due_at) d.DueDate = inv.due_at;
      const r = await exactPost(`${base_url}/api/v1/${division}/salesinvoice/SalesInvoices`, access_token, d);
      if (!r.ok) return jsonRes({ error: r.error }, 500);
      const eid = r.data?.InvoiceID;
      const upd: Record<string, any> = { exact_id: eid };
      let fin = null;
      if (config.auto_finalize && eid) { fin = await finalizeInvoice(base_url, division, access_token, eid); if (fin.ok && fin.invoiceNumber) upd.invoice_number = fin.invoiceNumber; }
      if (eid) await sb.from("invoices").update(upd).eq("id", inv.id);
      await logUsage(sb, companyId, "exact_create_invoice", { invoice_id });
      return jsonRes({ success: true, exact_id: eid, finalized: fin?.ok || false });
    }

    case "pull-invoices": {
      const invs = await exactGetAll(base_url, division, "salesinvoice/SalesInvoices", access_token, "$select=InvoiceID,InvoiceNumber,InvoiceDate,AmountDC,Status,Description,OrderedBy,DueDate&$orderby=InvoiceDate desc");
      const { data: lc } = await sb.from("customers").select("id, exact_account_id, name").eq("company_id", companyId).not("exact_account_id", "is", null);
      const cm = new Map<string, { id: string; name: string }>(); for (const c of lc || []) if (c.exact_account_id) cm.set(c.exact_account_id, { id: c.id, name: c.name });
      const aids = invs.map((i: any) => i.InvoiceID).filter(Boolean);
      const { data: ei } = await sb.from("invoices").select("exact_id").eq("company_id", companyId).in("exact_id", aids.length ? aids : ["__none__"]);
      const es = new Set((ei || []).map((i: any) => i.exact_id));
      let imported = 0, al = 0; const errors: string[] = [];
      for (const inv of invs) {
        if (es.has(inv.InvoiceID)) { al++; continue; }
        if (!inv.OrderedBy || !cm.has(inv.OrderedBy)) continue;
        const cu = cm.get(inv.OrderedBy)!;
        try {
          const amt = Number(inv.AmountDC) || 0; const vp = 21; const sub = Math.round(amt / (1 + vp/100) * 100) / 100;
          await sb.from("invoices").insert({ company_id: companyId, customer_id: cu.id, exact_id: inv.InvoiceID, invoice_number: inv.InvoiceNumber ? String(inv.InvoiceNumber) : null, status: "verzonden", total: amt, subtotal: sub, vat_amount: Math.round((amt - sub) * 100) / 100, vat_percentage: vp, issued_at: parseODataDate(inv.InvoiceDate), due_at: parseODataDate(inv.DueDate), notes: inv.Description || null, items: [] });
          imported++;
        } catch (e: any) { errors.push(`${inv.InvoiceNumber}: ${e.message}`); }
      }
      await logUsage(sb, companyId, "exact_pull_invoices", { imported, already_linked: al, errors: errors.length });
      return jsonRes({ total_in_exact: invs.length, imported, already_linked: al, errors });
    }

    case "pull-status": {
      const { data: li } = await sb.from("invoices").select("id, exact_id, invoice_number").eq("company_id", companyId).not("exact_id", "is", null).neq("status", "betaald");
      if (!li?.length) return jsonRes({ checked: 0, updated: 0, errors: [] });
      // #1: Use ReceivablesList — invoices NOT in list are fully paid
      const recv = await exactGetAll(base_url, division, "read/financial/ReceivablesList", access_token, "$select=InvoiceNumber,Amount,DueDate");
      const outstanding = new Set<string>(); for (const r of recv) if (r.InvoiceNumber) outstanding.add(String(r.InvoiceNumber));
      let checked = li.length, updated = 0; const errors: string[] = [];
      for (const inv of li) {
        if (inv.invoice_number && !outstanding.has(inv.invoice_number)) {
          try { await sb.from("invoices").update({ status: "betaald", paid_at: new Date().toISOString().split("T")[0] }).eq("id", inv.id); updated++; }
          catch (e: any) { errors.push(`${inv.invoice_number}: ${e.message}`); }
        }
      }
      await logUsage(sb, companyId, "exact_pull_status", { checked, updated, errors: errors.length });
      return jsonRes({ checked, updated, errors, outstanding_count: outstanding.size });
    }

    case "sync-quotes": {
      const { data: qs } = await sb.from("quotes").select("*, customers(name, email, exact_account_id, kvk_number, btw_number, id, phone, city, postal_code, address)").eq("company_id", companyId).in("status", ["verzonden", "verstuurd"]).is("exact_id", null);
      if (!qs?.length) return jsonRes({ synced: 0, skipped: 0, errors: [] });
      let synced = 0, skipped = 0; const errors: string[] = [];
      for (const q of qs) {
        try {
          const cu = q.customers as any;
          let aid = cu?.exact_account_id;
          if (!aid && cu?.id) aid = await ensureExactAccount(sb, base_url, division, access_token, cu);
          if (!aid) { skipped++; errors.push(`${q.quote_number}: Klant niet in Exact`); continue; }
          const vp = Number(q.vat_percentage || 21);
          const lines = buildQuotationLines((q.items as any[]) || [], vp, config);
          if (!lines.length) { skipped++; errors.push(`${q.quote_number}: Geen regels`); continue; }
          const d: Record<string, unknown> = { OrderAccount: aid, Description: `Offerte ${q.quote_number || ""}`.trim(), QuotationDate: q.issued_at || new Date().toISOString().split("T")[0], QuotationLines: lines };
          if (q.valid_until) d.ClosingDate = q.valid_until;
          const r = await exactPost(`${base_url}/api/v1/${division}/crm/Quotations`, access_token, d);
          if (!r.ok) { errors.push(`${q.quote_number}: ${r.error}`); continue; }
          const qid = r.data?.QuotationID;
          if (qid) await sb.from("quotes").update({ exact_id: qid }).eq("id", q.id);
          synced++;
        } catch (e: any) { errors.push(`${q.quote_number}: ${e.message}`); }
      }
      await logUsage(sb, companyId, "exact_sync_quotes", { synced, skipped, errors: errors.length });
      return jsonRes({ synced, skipped, errors });
    }

    case "create-quote": {
      const { quote_id } = body; if (!quote_id) return jsonRes({ error: "quote_id is required" }, 400);
      const { data: q } = await sb.from("quotes").select("*, customers(*)").eq("id", quote_id).eq("company_id", companyId).single();
      if (!q) return jsonRes({ error: "Offerte niet gevonden" }, 404);
      const cu = q.customers as any;
      const aid = await ensureExactAccount(sb, base_url, division, access_token, cu);
      if (!aid) return jsonRes({ error: "Klant niet naar Exact" }, 500);
      const vp = Number(q.vat_percentage || 21);
      const lines = buildQuotationLines((q.items as any[]) || [], vp, config);
      if (!lines.length) return jsonRes({ error: "Geen offerteregels" }, 400);
      const d: Record<string, unknown> = { OrderAccount: aid, Description: `Offerte ${q.quote_number || ""}`.trim(), QuotationDate: q.issued_at || new Date().toISOString().split("T")[0], QuotationLines: lines };
      if (q.valid_until) d.ClosingDate = q.valid_until;
      const r = await exactPost(`${base_url}/api/v1/${division}/crm/Quotations`, access_token, d);
      if (!r.ok) return jsonRes({ error: r.error }, 500);
      const qid = r.data?.QuotationID;
      if (qid) await sb.from("quotes").update({ exact_id: qid }).eq("id", q.id);
      await logUsage(sb, companyId, "exact_create_quote", { quote_id });
      return jsonRes({ success: true, exact_id: qid });
    }

    case "accept-quote": {
      const { quote_id, create_invoice } = body;
      if (!quote_id) return jsonRes({ error: "quote_id is verplicht" }, 400);
      const { data: q } = await sb.from("quotes").select("exact_id").eq("id", quote_id).eq("company_id", companyId).single();
      if (!q?.exact_id) return jsonRes({ error: "Offerte niet gesynchroniseerd" }, 404);
      const r = await exactPost(`${base_url}/api/v1/${division}/crm/AcceptQuotation`, access_token, { QuotationID: q.exact_id, Action: create_invoice ? 2 : 0 });
      if (!r.ok) return jsonRes({ error: r.error }, 500);
      await sb.from("quotes").update({ status: "geaccepteerd" }).eq("id", quote_id);
      return jsonRes({ success: true, created_invoice: create_invoice || false });
    }

    case "reject-quote": {
      const { quote_id } = body; if (!quote_id) return jsonRes({ error: "quote_id is verplicht" }, 400);
      const { data: q } = await sb.from("quotes").select("exact_id").eq("id", quote_id).eq("company_id", companyId).single();
      if (!q?.exact_id) return jsonRes({ error: "Offerte niet gesynchroniseerd" }, 404);
      const r = await exactPost(`${base_url}/api/v1/${division}/crm/RejectQuotation`, access_token, { QuotationID: q.exact_id });
      if (!r.ok) return jsonRes({ error: r.error }, 500);
      await sb.from("quotes").update({ status: "afgewezen" }).eq("id", quote_id);
      return jsonRes({ success: true });
    }

    case "pull-quotes": {
      const qs = await exactGetAll(base_url, division, "crm/Quotations", access_token, "$select=QuotationID,QuotationNumber,QuotationDate,AmountDC,Description,OrderAccount,Status&$orderby=QuotationDate desc");
      const { data: lc } = await sb.from("customers").select("id, exact_account_id").eq("company_id", companyId).not("exact_account_id", "is", null);
      const cm = new Map<string, string>(); for (const c of lc || []) if (c.exact_account_id) cm.set(c.exact_account_id, c.id);
      const ids = qs.map((q: any) => q.QuotationID).filter(Boolean);
      const { data: eq } = await sb.from("quotes").select("exact_id").eq("company_id", companyId).in("exact_id", ids.length ? ids : ["__none__"]);
      const es = new Set((eq || []).map((q: any) => q.exact_id));
      const sm: Record<number, string> = { 5: "afgewezen", 20: "concept", 25: "verzonden", 50: "geaccepteerd" };
      let imported = 0, already = 0; const errors: string[] = [];
      for (const q of qs) {
        if (es.has(q.QuotationID)) { already++; continue; }
        const cid = q.OrderAccount ? cm.get(q.OrderAccount) : null;
        if (!cid) continue;
        try {
          const amt = Number(q.AmountDC) || 0; const sub = Math.round(amt / 1.21 * 100) / 100;
          await sb.from("quotes").insert({ company_id: companyId, customer_id: cid, exact_id: q.QuotationID, status: sm[Number(q.Status)] || "verzonden", total: amt, subtotal: sub, vat_amount: Math.round((amt - sub) * 100) / 100, vat_percentage: 21, issued_at: parseODataDate(q.QuotationDate), notes: q.Description || null, items: [] });
          imported++;
        } catch (e: any) { errors.push(`${q.QuotationNumber}: ${e.message}`); }
      }
      return jsonRes({ total_in_exact: qs.length, imported, already_linked: already, errors });
    }

    case "finalize-invoice": {
      const { invoice_id } = body; if (!invoice_id) return jsonRes({ error: "invoice_id verplicht" }, 400);
      const { data: inv } = await sb.from("invoices").select("exact_id").eq("id", invoice_id).eq("company_id", companyId).single();
      if (!inv?.exact_id) return jsonRes({ error: "Niet gesynchroniseerd" }, 404);
      const fin = await finalizeInvoice(base_url, division, access_token, inv.exact_id);
      if (!fin.ok) return jsonRes({ error: fin.error }, 500);
      if (fin.invoiceNumber) await sb.from("invoices").update({ invoice_number: fin.invoiceNumber }).eq("id", invoice_id);
      return jsonRes({ success: true, invoice_number: fin.invoiceNumber });
    }

    case "financial-summary": {
      const recv = await exactGetAll(base_url, division, "read/financial/ReceivablesList", access_token, "$select=InvoiceNumber,Amount,DueDate");
      let total = 0, odCount = 0, odAmt = 0; const today = new Date().toISOString().split("T")[0];
      for (const r of recv) { const a = Number(r.Amount) || 0; total += a; const dd = parseODataDate(r.DueDate); if (dd && dd < today) { odCount++; odAmt += a; } }
      return jsonRes({ total_outstanding: Math.round(total * 100) / 100, total_receivables: recv.length, overdue_count: odCount, overdue_amount: Math.round(odAmt * 100) / 100 });
    }

    default: return jsonRes({ error: `Onbekende actie: ${action}` }, 400);
    }
  } catch (err: any) {
    if (err instanceof AuthError) return jsonRes({ error: err.message }, err.status);
    if (err instanceof RateLimitError) return jsonRes({ error: err.message }, 429);
    const msg = err.message || "";
    if (msg === "REAUTH_REQUIRED" || msg.includes("Tenant not active")) {
      try { const sb = createAdminClient(); const a = await authenticateRequest(req).catch(() => null); if (a) await sb.from("exact_config").update({ status: "error" }).eq("company_id", a.companyId); } catch {}
      return jsonRes({ error: "Exact Online koppeling niet actief.", needs_reauth: true }, 401);
    }
    console.error("sync-exact error:", err);
    return jsonRes({ error: err.message || "Internal error" }, 500);
  }
});
