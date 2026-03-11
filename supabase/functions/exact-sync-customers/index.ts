// exact-sync-customers — Push/Pull/Sync klanten naar/van Exact Online
// Aangepast aan Vakflow schema: customers.name (niet first_name/last_name), company_id (niet division_id)

import { jsonRes, optionsResponse } from "../_shared/cors.ts";
import { createAdminClient, authenticateRequest, AuthError } from "../_shared/supabase.ts";
import { getExactTokenFromConnection } from "../_shared/exact-connect.ts";

interface ExactAccount {
  ID?: string;
  Code?: string;
  Name: string;
  Email?: string;
  Phone?: string;
  AddressLine1?: string;
  City?: string;
  Postcode?: string;
  Country?: string;
  VATNumber?: string;
  ChamberOfCommerce?: string;
  Status?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);

  try {
    const { companyId } = await authenticateRequest(req);
    const admin = createAdminClient();
    const { action, divisionId, customerId } = await req.json();

    if (!divisionId) throw new Error("divisionId is required");

    const { data: connection, error: connError } = await admin
      .from("exact_online_connections")
      .select("*")
      .eq("division_id", divisionId)
      .eq("is_active", true)
      .single();

    if (connError || !connection) throw new Error("Geen actieve Exact Online verbinding gevonden");

    const tokenData = await getExactTokenFromConnection(connection);
    const { access_token, base_url, division } = tokenData;

    if (action === "push") {
      const result = await pushCustomers(admin, access_token, base_url, division, companyId, customerId);
      return jsonRes(result, 200, req);
    } else if (action === "pull") {
      const result = await pullCustomers(admin, access_token, base_url, division, companyId);
      return jsonRes(result, 200, req);
    } else if (action === "sync") {
      const pushRes = await pushCustomers(admin, access_token, base_url, division, companyId, customerId);
      const pullRes = await pullCustomers(admin, access_token, base_url, division, companyId);
      return jsonRes({ success: true, pushed: pushRes, pulled: pullRes }, 200, req);
    }
    throw new Error("Invalid action. Use 'push', 'pull', or 'sync'");
  } catch (err: any) {
    if (err instanceof AuthError) return jsonRes({ error: err.message }, err.status, req);
    console.error("exact-sync-customers error:", err);
    return jsonRes({ error: err.message }, 500, req);
  }
});

// deno-lint-ignore no-explicit-any
async function pushCustomers(supabase: any, accessToken: string, baseUrl: string, exactDivision: number, companyId: string, customerId?: string) {
  let query = supabase.from("customers").select("*").eq("company_id", companyId);
  if (customerId) query = query.eq("id", customerId);
  else query = query.is("exact_account_id", null);

  const { data: customers, error } = await query;
  if (error) throw error;

  const results = { success: true, created: 0, updated: 0, failed: 0, errors: [] as string[] };

  for (const customer of (customers || [])) {
    try {
      const exactAccount: ExactAccount = {
        Name: customer.name || "Onbekend",
        Email: customer.email || undefined,
        Phone: customer.phone || undefined,
        AddressLine1: customer.address || undefined,
        City: customer.city || undefined,
        Postcode: customer.postal_code || undefined,
        VATNumber: customer.btw_number || undefined,
        ChamberOfCommerce: customer.kvk_number || undefined,
        Status: "C",
      };

      if (customer.exact_account_id) {
        const res = await fetch(`${baseUrl}/api/v1/${exactDivision}/crm/Accounts(guid'${customer.exact_account_id}')`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(exactAccount),
        });
        if (!res.ok) { results.failed++; results.errors.push(`Update ${customer.name}: ${await res.text()}`); }
        else { await res.text(); results.updated++; }
      } else {
        const res = await fetch(`${baseUrl}/api/v1/${exactDivision}/crm/Accounts`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(exactAccount),
        });
        if (!res.ok) { results.failed++; results.errors.push(`Create ${customer.name}: ${await res.text()}`); }
        else {
          const data = await res.json();
          const exactId = data.d?.ID;
          if (exactId) await supabase.from("customers").update({ exact_account_id: exactId }).eq("id", customer.id);
          results.created++;
        }
      }
    } catch (err) {
      results.failed++;
      results.errors.push(`${customer.name}: ${String(err)}`);
    }
  }
  return results;
}

// deno-lint-ignore no-explicit-any
async function pullCustomers(supabase: any, accessToken: string, baseUrl: string, exactDivision: number, companyId: string) {
  const results = { success: true, imported: 0, updated: 0, skipped: 0, errors: [] as string[] };

  let nextPageUrl: string | null = `${baseUrl}/api/v1/${exactDivision}/crm/Accounts?$select=ID,Code,Name,Email,Phone,AddressLine1,City,Postcode,Country,VATNumber,ChamberOfCommerce,Status&$filter=Status eq 'C'&$top=500`;

  while (nextPageUrl) {
    const url = nextPageUrl;
    nextPageUrl = null;

    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } });
    if (!res.ok) throw new Error(`Exact API error: ${await res.text()}`);

    const responseData = await res.json();
    const accounts: ExactAccount[] = responseData.d?.results || [];

    for (const account of accounts) {
      try {
        if (!account.ID) continue;

        // Check if already linked
        const { data: existing } = await supabase.from("customers").select("id").eq("exact_account_id", account.ID).eq("company_id", companyId).maybeSingle();
        if (existing) {
          // Update existing
          await supabase.from("customers").update({
            name: account.Name || existing.name,
            email: account.Email || null,
            phone: account.Phone || null,
            city: account.City || null,
            postal_code: account.Postcode || null,
            address: account.AddressLine1 || null,
            btw_number: account.VATNumber || null,
            kvk_number: account.ChamberOfCommerce || null,
          }).eq("id", existing.id);
          results.updated++;
          continue;
        }

        // Try to match by email or name
        const { data: match } = await supabase.from("customers").select("id")
          .eq("company_id", companyId).is("exact_account_id", null)
          .or(`email.eq.${account.Email},name.eq.${account.Name}`)
          .limit(1).maybeSingle();

        if (match) {
          await supabase.from("customers").update({ exact_account_id: account.ID }).eq("id", match.id);
          results.updated++;
        } else {
          // Import as new customer
          const { error: insertError } = await supabase.from("customers").insert({
            company_id: companyId,
            name: account.Name || "Onbekend",
            email: account.Email || null,
            phone: account.Phone || null,
            city: account.City || null,
            postal_code: account.Postcode || null,
            address: account.AddressLine1 || null,
            btw_number: account.VATNumber || null,
            kvk_number: account.ChamberOfCommerce || null,
            exact_account_id: account.ID,
            type: "zakelijk",
          });
          if (insertError) results.errors.push(`Import ${account.Name}: ${insertError.message}`);
          else results.imported++;
        }
      } catch (err) {
        results.skipped++;
      }
    }

    const nextLink = responseData.d?.__next;
    if (nextLink && accounts.length > 0) nextPageUrl = nextLink;
  }

  return results;
}
