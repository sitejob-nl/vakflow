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
    const { action, divisionId } = await req.json();
    if (!divisionId) throw new Error("divisionId is required");

    const { data: connection, error: connError } = await supabase
      .from("exact_online_connections").select("*")
      .eq("division_id", divisionId).eq("is_active", true).single();
    if (connError || !connection) throw new Error("No active Exact Online connection found");

    const tokenData = await getExactTokenFromConnection(connection);
    const { access_token: accessToken, base_url: baseUrl, division: exactDivision } = tokenData;

    let result;
    if (action === "push") {
      result = await pushItems(supabase, accessToken, baseUrl, exactDivision, divisionId);
    } else if (action === "pull") {
      result = await pullItems(supabase, accessToken, baseUrl, exactDivision, divisionId);
    } else if (action === "sync") {
      const pushRes = await pushItems(supabase, accessToken, baseUrl, exactDivision, divisionId);
      const pullRes = await pullItems(supabase, accessToken, baseUrl, exactDivision, divisionId);
      result = { success: true, pushed: pushRes, pulled: pullRes };
    } else {
      throw new Error("Invalid action. Use 'push', 'pull', or 'sync'");
    }

    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Item sync error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// deno-lint-ignore no-explicit-any
async function pushItems(supabase: any, accessToken: string, baseUrl: string, exactDivision: number, divisionId: string) {
  const results = { success: true, created: 0, skipped: 0, failed: 0, errors: [] as string[] };

  // Get products without exact_item_id that have an article_code
  const { data: products, error } = await supabase
    .from("products")
    .select("id, article_code, name, base_price, cost_price, supplier_id, suppliers!inner(division_id)")
    .is("exact_item_id", null)
    .not("article_code", "is", null);

  if (error) throw error;

  // Filter by division (products belong to suppliers that belong to a division)
  const divisionProducts = (products || []).filter(
    // deno-lint-ignore no-explicit-any
    (p: any) => p.suppliers?.division_id === divisionId || !p.suppliers?.division_id
  );

  for (const product of divisionProducts) {
    try {
      if (!product.article_code) { results.skipped++; continue; }

      // Check if item already exists in Exact by Code
      const searchUrl = `${baseUrl}/api/v1/${exactDivision}/logistics/Items?$filter=Code eq '${product.article_code}'&$select=ID,Code&$top=1`;
      const searchRes = await fetch(searchUrl, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } });

      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const existing = (searchData.d?.results || [])[0];
        if (existing?.ID) {
          // Already exists, just save the ID
          await supabase.from("products").update({ exact_item_id: existing.ID }).eq("id", product.id);
          results.skipped++;
          continue;
        }
      } else { await searchRes.text(); }

      // Create new item
      const itemData: Record<string, unknown> = {
        Code: product.article_code.substring(0, 30),
        Description: (product.name || product.article_code).substring(0, 100),
        IsSalesItem: true,
      };
      if (product.cost_price) itemData.CostPriceStandard = product.cost_price;
      else if (product.base_price) itemData.CostPriceStandard = product.base_price;

      const res = await fetch(`${baseUrl}/api/v1/${exactDivision}/logistics/Items`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(itemData),
      });

      if (!res.ok) {
        results.failed++;
        results.errors.push(`${product.article_code}: ${await res.text()}`);
      } else {
        const data = await res.json();
        const itemId = data.d?.ID;
        if (itemId) {
          await supabase.from("products").update({ exact_item_id: itemId }).eq("id", product.id);
        }
        results.created++;
      }
    } catch (err) {
      results.failed++;
      results.errors.push(`${product.article_code}: ${String(err)}`);
    }
  }

  return results;
}

// deno-lint-ignore no-explicit-any
async function pullItems(supabase: any, accessToken: string, baseUrl: string, exactDivision: number, _divisionId: string) {
  const results = { success: true, matched: 0, skipped: 0, errors: [] as string[] };

  let hasMore = true;
  let nextPageUrl: string | null = `${baseUrl}/api/v1/${exactDivision}/bulk/Logistics/Items?$select=ID,Code,Description,CostPriceStandard,IsSalesItem&$top=1000`;

  while (hasMore && nextPageUrl) {
    const url = nextPageUrl;
    nextPageUrl = null;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } });

    if (!response.ok) { console.error("Failed to fetch items:", await response.text()); break; }

    const data = await response.json();
    const items = data.d?.results || [];

    for (const item of items) {
      if (!item.Code) continue;

      // Try to match by article_code
      const { data: products } = await supabase
        .from("products")
        .select("id, exact_item_id")
        .eq("article_code", item.Code)
        .is("exact_item_id", null)
        .limit(1);

      if (products && products.length > 0) {
        await supabase.from("products").update({ exact_item_id: item.ID }).eq("id", products[0].id);
        results.matched++;
      } else {
        results.skipped++;
      }
    }

    const nextUrl = data.d?.__next;
    if (nextUrl && items.length > 0) {
      nextPageUrl = nextUrl;
    } else { hasMore = false; }
  }

  return results;
}
