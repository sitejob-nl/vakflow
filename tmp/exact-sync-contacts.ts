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
      result = await pushContacts(supabase, accessToken, baseUrl, exactDivision, divisionId);
    } else if (action === "pull") {
      result = await pullContacts(supabase, accessToken, baseUrl, exactDivision, divisionId);
    } else if (action === "sync") {
      const pushRes = await pushContacts(supabase, accessToken, baseUrl, exactDivision, divisionId);
      const pullRes = await pullContacts(supabase, accessToken, baseUrl, exactDivision, divisionId);
      result = { success: true, pushed: pushRes, pulled: pullRes };
    } else {
      throw new Error("Invalid action. Use 'push', 'pull', or 'sync'");
    }

    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Contact sync error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// deno-lint-ignore no-explicit-any
async function pushContacts(supabase: any, accessToken: string, baseUrl: string, exactDivision: number, divisionId: string) {
  const results = { success: true, created: 0, updated: 0, skipped: 0, failed: 0, errors: [] as string[] };

  const { data: customers, error } = await supabase
    .from("customers")
    .select("id, first_name, last_name, email, phone, mobile, city, postal_code, street_address, exact_account_id, exact_contact_id")
    .eq("division_id", divisionId)
    .not("exact_account_id", "is", null);

  if (error) throw error;

  for (const customer of (customers || [])) {
    try {
      if (!customer.first_name && !customer.last_name) { results.skipped++; continue; }

      const contactData: Record<string, unknown> = {
        Account: customer.exact_account_id,
        FirstName: customer.first_name || "",
        LastName: customer.last_name || "",
      };
      if (customer.email) contactData.Email = customer.email;
      if (customer.phone) contactData.BusinessPhone = customer.phone;
      if (customer.mobile) contactData.BusinessMobile = customer.mobile;
      if (customer.city) contactData.City = customer.city;
      if (customer.postal_code) contactData.Postcode = customer.postal_code;
      // Note: Contacts inherit address from Account, AddressStreet is not a valid field

      if (customer.exact_contact_id) {
        // PUT update
        const res = await fetch(`${baseUrl}/api/v1/${exactDivision}/crm/Contacts(guid'${customer.exact_contact_id}')`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(contactData),
        });
        if (!res.ok) {
          results.failed++;
          results.errors.push(`${customer.last_name}: ${await res.text()}`);
        } else {
          await res.text();
          results.updated++;
        }
      } else {
        // POST create
        const res = await fetch(`${baseUrl}/api/v1/${exactDivision}/crm/Contacts`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(contactData),
        });
        if (!res.ok) {
          results.failed++;
          results.errors.push(`${customer.last_name}: ${await res.text()}`);
        } else {
          const data = await res.json();
          const contactId = data.d?.ID;
          if (contactId) {
            await supabase.from("customers").update({ exact_contact_id: contactId }).eq("id", customer.id);
          }
          results.created++;
        }
      }
    } catch (err) {
      results.failed++;
      results.errors.push(`${customer.last_name}: ${String(err)}`);
    }
  }

  return results;
}

// deno-lint-ignore no-explicit-any
async function pullContacts(supabase: any, accessToken: string, baseUrl: string, exactDivision: number, divisionId: string) {
  const results = { success: true, updated: 0, skipped: 0, errors: [] as string[] };

  // Get all customers with exact_account_id for this division
  const { data: customers, error } = await supabase
    .from("customers")
    .select("id, exact_account_id, exact_contact_id")
    .eq("division_id", divisionId)
    .not("exact_account_id", "is", null);

  if (error) throw error;

  const accountToCustomer = new Map<string, string>();
  for (const c of (customers || [])) {
    if (c.exact_account_id) accountToCustomer.set(c.exact_account_id, c.id);
  }

  // Fetch contacts from Exact (paginated)
  let hasMore = true;
  let nextPageUrl: string | null = `${baseUrl}/api/v1/${exactDivision}/crm/Contacts?$select=ID,Account,FirstName,LastName,Email,BusinessPhone,BusinessMobile,City,Postcode,IsMainContact&$filter=IsMainContact eq true&$top=1000`;

  while (hasMore && nextPageUrl) {
    const url = nextPageUrl;
    nextPageUrl = null;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } });

    if (!response.ok) { console.error("Failed to fetch contacts:", await response.text()); break; }

    const data = await response.json();
    const contacts = data.d?.results || [];

    for (const contact of contacts) {
      const customerId = accountToCustomer.get(contact.Account);
      if (!customerId) continue;

      const updates: Record<string, unknown> = { exact_contact_id: contact.ID };
      if (contact.FirstName) updates.first_name = contact.FirstName;
      if (contact.LastName) updates.last_name = contact.LastName;
      if (contact.Email) updates.email = contact.Email;
      if (contact.BusinessPhone) updates.phone = contact.BusinessPhone;
      if (contact.BusinessMobile) updates.mobile = contact.BusinessMobile;
      if (contact.City) updates.city = contact.City;
      if (contact.Postcode) updates.postal_code = contact.Postcode;

      await supabase.from("customers").update(updates).eq("id", customerId);
      results.updated++;
    }

    const nextUrl = data.d?.__next;
    if (nextUrl && contacts.length > 0) {
      // Use __next URL directly instead of parsing skiptoken
      nextPageUrl = nextUrl;
    } else { hasMore = false; }
  }

  return results;
}
