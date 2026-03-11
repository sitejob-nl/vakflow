// exact-sync-items — Push/Pull materialen (items) naar/van Exact Online
// Vakflow: materials table, company_id

import { jsonRes, optionsResponse } from "../_shared/cors.ts";
import { createAdminClient, authenticateRequest, AuthError } from "../_shared/supabase.ts";
import { getExactTokenFromConnection } from "../_shared/exact-connect.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);

  try {
    const { companyId } = await authenticateRequest(req);
    const admin = createAdminClient();
    const { action, divisionId } = await req.json();
    if (!divisionId) throw new Error("divisionId is required");

    const { data: connection, error: connError } = await admin
      .from("exact_online_connections").select("*")
      .eq("division_id", divisionId).eq("is_active", true).single();
    if (connError || !connection) throw new Error("Geen actieve Exact Online verbinding gevonden");

    const { access_token, base_url, division } = await getExactTokenFromConnection(connection);

    let result;
    if (action === "push") {
      result = await pushItems(admin, access_token, base_url, division, companyId);
    } else if (action === "pull") {
      result = await pullItems(admin, access_token, base_url, division, companyId);
    } else if (action === "sync") {
      const pushRes = await pushItems(admin, access_token, base_url, division, companyId);
      const pullRes = await pullItems(admin, access_token, base_url, division, companyId);
      result = { success: true, pushed: pushRes, pulled: pullRes };
    } else {
      throw new Error("Invalid action. Use 'push', 'pull', or 'sync'");
    }
    return jsonRes(result, 200, req);
  } catch (err: any) {
    if (err instanceof AuthError) return jsonRes({ error: err.message }, err.status, req);
    console.error("exact-sync-items error:", err);
    return jsonRes({ error: err.message }, 500, req);
  }
});

// deno-lint-ignore no-explicit-any
async function pushItems(supabase: any, accessToken: string, baseUrl: string, exactDivision: number, companyId: string) {
  const results = { success: true, created: 0, skipped: 0, failed: 0, errors: [] as string[] };

  const { data: materials, error } = await supabase.from("materials").select("*")
    .eq("company_id", companyId).not("article_number", "is", null);
  if (error) throw error;

  for (const mat of (materials || [])) {
    try {
      if (!mat.article_number) { results.skipped++; continue; }

      // Check if already exists in Exact by Code
      const searchUrl = `${baseUrl}/api/v1/${exactDivision}/logistics/Items?$filter=Code eq '${mat.article_number}'&$select=ID,Code&$top=1`;
      const searchRes = await fetch(searchUrl, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const existing = (searchData.d?.results || [])[0];
        if (existing?.ID) { results.skipped++; continue; }
      }

      const itemData: Record<string, unknown> = {
        Code: mat.article_number.substring(0, 30),
        Description: (mat.name || mat.article_number).substring(0, 100),
        IsSalesItem: true,
      };
      if (mat.cost_price) itemData.CostPriceStandard = mat.cost_price;

      const res = await fetch(`${baseUrl}/api/v1/${exactDivision}/logistics/Items`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(itemData),
      });

      if (!res.ok) {
        results.failed++;
        results.errors.push(`${mat.article_number}: ${await res.text()}`);
      } else {
        results.created++;
      }
    } catch (err) {
      results.failed++;
      results.errors.push(`${mat.article_number}: ${String(err)}`);
    }
  }
  return results;
}

// deno-lint-ignore no-explicit-any
async function pullItems(supabase: any, accessToken: string, baseUrl: string, exactDivision: number, companyId: string) {
  const results = { success: true, matched: 0, skipped: 0, errors: [] as string[] };

  let nextPageUrl: string | null = `${baseUrl}/api/v1/${exactDivision}/logistics/Items?$select=ID,Code,Description,CostPriceStandard&$filter=IsSalesItem eq true&$top=500`;

  while (nextPageUrl) {
    const url = nextPageUrl;
    nextPageUrl = null;

    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } });
    if (!res.ok) break;

    const data = await res.json();
    const items = data.d?.results || [];

    for (const item of items) {
      if (!item.Code) continue;

      // Try to match by article_number
      const { data: mats } = await supabase.from("materials")
        .select("id").eq("company_id", companyId).eq("article_number", item.Code).limit(1);

      if (mats && mats.length > 0) {
        results.matched++;
      } else {
        results.skipped++;
      }
    }

    const nextUrl = data.d?.__next;
    if (nextUrl && items.length > 0) nextPageUrl = nextUrl;
  }
  return results;
}
