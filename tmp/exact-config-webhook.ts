import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getExactTokenFromConnection } from "../_shared/exact-connect.ts";
import { requireAuthOrService } from "../_shared/require-auth-or-service.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await requireAuthOrService(req);
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Missing Supabase configuration");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { action, divisionId, supplierOrderId } = await req.json();
    if (!divisionId) throw new Error("divisionId is required");

    const { data: connection, error: connError } = await supabase
      .from("exact_online_connections").select("*")
      .eq("division_id", divisionId).eq("is_active", true).single();

    if (connError || !connection) throw new Error("No active Exact Online connection found for this division");

    const tokenData = await getExactTokenFromConnection(connection);
    const accessToken = tokenData.access_token;
    const baseUrl = tokenData.base_url;
    const exactDivision = tokenData.division;

    if (action === "push") {
      const result = await pushPurchaseOrders(supabase, accessToken, baseUrl, exactDivision, divisionId, supplierOrderId);
      return new Response(JSON.stringify(result), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      throw new Error("Invalid action. Use 'push'");
    }
  } catch (error: unknown) {
    console.error("Purchase order sync error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// deno-lint-ignore no-explicit-any
async function pushPurchaseOrders(supabase: any, accessToken: string, baseUrl: string, exactDivision: number, divisionId: string, supplierOrderId?: string) {
  let query = supabase.from("supplier_orders").select(`
    id, order_id, supplier_id, status, total_amount, notes, sent_at, expected_delivery_date,
    exact_purchase_order_id,
    suppliers!inner(id, name, code, exact_supplier_id, contact_email),
    orders!inner(id, order_number, division_id),
    supplier_order_lines(id, quantity, unit_price, product_id, ean_code,
      products(article_code, name, description))
  `).eq("orders.division_id", divisionId);

  if (supplierOrderId) { query = query.eq("id", supplierOrderId); }
  else { query = query.is("exact_purchase_order_id", null); }

  const { data: supplierOrders, error } = await query;
  if (error) throw error;

  const results = { success: true, created: 0, skipped: 0, failed: 0, errors: [] as string[] };

  for (const so of supplierOrders || []) {
    try {
      if (so.exact_purchase_order_id && !supplierOrderId) { results.skipped++; continue; }

      const supplier = so.suppliers;
      let supplierId = supplier?.exact_supplier_id;

      if (!supplierId) {
        supplierId = await ensureSupplierInExact(supabase, accessToken, baseUrl, exactDivision, supplier);
        if (!supplierId) { results.failed++; results.errors.push(`Leverancier ${supplier?.name}: Kon niet aanmaken in Exact Online`); continue; }
      }

      const orderNumber = so.orders?.order_number || "?";
      const poLines = (so.supplier_order_lines || []).map((line: any) => {
        const product = line.products;
        return {
          Description: (product?.name || product?.description || `Product ${line.product_id || ""}`).substring(0, 60),
          Quantity: line.quantity || 1,
          NetPrice: line.unit_price || 0,
          VATCode: "2",
        };
      });

      if (poLines.length === 0) {
        poLines.push({ Description: `Inkooporder voor order #${orderNumber}`, Quantity: 1, NetPrice: so.total_amount || 0, VATCode: "2" });
      }

      const purchaseOrder = {
        Supplier: supplierId,
        Description: `Inkooporder ${supplier?.name} - Order #${orderNumber}`,
        OrderDate: so.sent_at || new Date().toISOString().split("T")[0],
        YourRef: `ORD-${orderNumber}`,
        Currency: "EUR",
        Remarks: so.notes || undefined,
        ReceiptDate: so.expected_delivery_date || undefined,
        PurchaseOrderLines: poLines,
      };

      const response = await fetch(`${baseUrl}/api/v1/${exactDivision}/purchaseorder/PurchaseOrders`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(purchaseOrder),
      });

      if (!response.ok) {
        const errorText = await response.text();
        results.failed++;
        results.errors.push(`${supplier?.name} (order #${orderNumber}): ${errorText}`);
      } else {
        const data = await response.json();
        const poId = data.d?.PurchaseOrderID;
        const poNumber = data.d?.PurchaseOrderNumber;
        if (poId || poNumber) {
          await supabase.from("supplier_orders").update({ exact_purchase_order_id: poId || poNumber?.toString() }).eq("id", so.id);
        }
        results.created++;
      }
    } catch (err) {
      results.failed++;
      results.errors.push(`Supplier order ${so.id}: ${String(err)}`);
    }
  }

  return results;
}

// deno-lint-ignore no-explicit-any
async function ensureSupplierInExact(supabase: any, accessToken: string, baseUrl: string, exactDivision: number, supplier: any): Promise<string | null> {
  if (!supplier) return null;
  try {
    const searchUrl = `${baseUrl}/api/v1/${exactDivision}/crm/Accounts?$filter=Code eq '${supplier.code}'&$select=ID,Code,Name,Status`;
    const searchRes = await fetch(searchUrl, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } });

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      const existing = (searchData.d?.results || [])[0];
      if (existing?.ID) {
        await supabase.from("suppliers").update({ exact_supplier_id: existing.ID }).eq("id", supplier.id);
        return existing.ID;
      }
    } else { await searchRes.text(); }

    const accountData: Record<string, unknown> = { Code: supplier.code, Name: supplier.name, Status: "V" };
    if (supplier.contact_email) accountData.Email = supplier.contact_email;

    const createRes = await fetch(`${baseUrl}/api/v1/${exactDivision}/crm/Accounts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(accountData),
    });
    if (!createRes.ok) return null;
    const createData = await createRes.json();
    const newId = createData.d?.ID;
    if (newId) await supabase.from("suppliers").update({ exact_supplier_id: newId }).eq("id", supplier.id);
    return newId || null;
  } catch (err) { console.error("Error ensuring supplier in Exact:", err); return null; }
}
