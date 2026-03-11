import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getExactTokenFromConnection } from "../_shared/exact-connect.ts";
import { requireAuthOrService } from "../_shared/require-auth-or-service.ts";

interface AbitareCustomer {
  id: string;
  customer_number: number;
  customer_type: string;
  company_name: string | null;
  first_name: string | null;
  last_name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  street_address: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  vat_number: string | null;
  coc_number: string | null;
  exact_account_id: string | null;
  division_id: string | null;
}

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await requireAuthOrService(req);
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { action, divisionId, customerId } = await req.json();

    if (!divisionId) {
      throw new Error("divisionId is required");
    }

    const { data: connection, error: connError } = await supabase
      .from("exact_online_connections")
      .select("*")
      .eq("division_id", divisionId)
      .eq("is_active", true)
      .single();

    if (connError || !connection) {
      throw new Error("No active Exact Online connection found for this division");
    }

    // Get fresh token from SiteJob Connect
    const tokenData = await getExactTokenFromConnection(connection);
    const accessToken = tokenData.access_token;
    const baseUrl = tokenData.base_url;
    const exactDivision = tokenData.division;

    if (action === "push") {
      return await pushCustomers(supabase, accessToken, baseUrl, exactDivision, divisionId, customerId);
    } else if (action === "pull") {
      return await pullCustomers(supabase, accessToken, baseUrl, exactDivision, divisionId);
    } else if (action === "sync") {
      const pushResult = await pushCustomersInternal(supabase, accessToken, baseUrl, exactDivision, divisionId, customerId);
      const pullResult = await pullCustomersInternal(supabase, accessToken, baseUrl, exactDivision, divisionId);
      
      return new Response(JSON.stringify({
        success: true,
        pushed: pushResult,
        pulled: pullResult,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      throw new Error("Invalid action. Use 'push', 'pull', or 'sync'");
    }
  } catch (error: unknown) {
    console.error("Customer sync error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function pushCustomers(
  // deno-lint-ignore no-explicit-any
  supabase: any, accessToken: string, baseUrl: string, exactDivision: number, divisionId: string, customerId?: string
): Promise<Response> {
  const result = await pushCustomersInternal(supabase, accessToken, baseUrl, exactDivision, divisionId, customerId);
  return new Response(JSON.stringify(result), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function pushCustomersInternal(
  // deno-lint-ignore no-explicit-any
  supabase: any, accessToken: string, baseUrl: string, exactDivision: number, divisionId: string, customerId?: string
) {
  let query = supabase.from("customers").select("*").eq("division_id", divisionId);
  if (customerId) query = query.eq("id", customerId);
  const { data: customers, error } = await query;
  if (error) throw error;

  const results = { success: true, created: 0, updated: 0, failed: 0, errors: [] as string[] };

  for (const customer of customers as AbitareCustomer[]) {
    try {
      const exactAccount = mapToExactAccount(customer);

      if (customer.exact_account_id) {
        const response = await fetch(
          `${baseUrl}/api/v1/${exactDivision}/crm/Accounts(guid'${customer.exact_account_id}')`,
          {
            method: "PUT",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(exactAccount),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          results.failed++;
          results.errors.push(`Update failed for ${customer.last_name}: ${errorText}`);
        } else {
          await response.text();
          results.updated++;
        }
      } else {
        const response = await fetch(
          `${baseUrl}/api/v1/${exactDivision}/crm/Accounts`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(exactAccount),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          results.failed++;
          results.errors.push(`Create failed for ${customer.last_name}: ${errorText}`);
        } else {
          const data = await response.json();
          const exactId = data.d?.ID;
          if (exactId) {
            await supabase.from("customers").update({ exact_account_id: exactId }).eq("id", customer.id);
          }
          results.created++;
        }
      }
    } catch (err) {
      results.failed++;
      results.errors.push(`Error for ${customer.last_name}: ${String(err)}`);
    }
  }

  return results;
}

async function pullCustomers(
  // deno-lint-ignore no-explicit-any
  supabase: any, accessToken: string, baseUrl: string, exactDivision: number, divisionId: string
): Promise<Response> {
  const result = await pullCustomersInternal(supabase, accessToken, baseUrl, exactDivision, divisionId);
  return new Response(JSON.stringify(result), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function pullCustomersInternal(
  // deno-lint-ignore no-explicit-any
  supabase: any, accessToken: string, baseUrl: string, exactDivision: number, divisionId: string
) {
  const results = { success: true, imported: 0, updated: 0, skipped: 0, errors: [] as string[] };

  let hasMore = true;
  let nextPageUrl: string | null = `${baseUrl}/api/v1/${exactDivision}/sync/CRM/Accounts?$select=ID,Code,Name,Email,Phone,AddressLine1,City,Postcode,Country,VATNumber,ChamberOfCommerce,Status&$top=1000`;
  
  while (hasMore && nextPageUrl) {
    const url = nextPageUrl;
    nextPageUrl = null;
    
    const fetchResponse = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });

    if (!fetchResponse.ok) {
      throw new Error(`Failed to fetch accounts from Exact: ${await fetchResponse.text()}`);
    }

    const responseData = await fetchResponse.json();
    const accounts = responseData.d?.results || [];

    for (const account of accounts as ExactAccount[]) {
      try {
        const { data: existingCustomer } = await supabase
          .from("customers").select("id").eq("exact_account_id", account.ID).single();

        if (existingCustomer) {
          await supabase.from("customers").update(mapFromExactAccount(account)).eq("id", existingCustomer.id);
          results.updated++;
        } else {
          const { data: matchingCustomer } = await supabase
            .from("customers").select("id, exact_account_id")
            .eq("division_id", divisionId)
            .or(`email.eq.${account.Email},last_name.eq.${account.Name}`)
            .is("exact_account_id", null).limit(1).single();

          if (matchingCustomer) {
            await supabase.from("customers").update({ exact_account_id: account.ID }).eq("id", matchingCustomer.id);
            results.updated++;
          } else {
            const { error: insertError } = await supabase.from("customers").insert({
              ...mapFromExactAccount(account),
              exact_account_id: account.ID,
              division_id: divisionId,
              customer_type: "zakelijk" as const,
            });
            if (insertError) {
              results.errors.push(`Import failed for ${account.Name}: ${insertError.message}`);
            } else {
              results.imported++;
            }
          }
        }
      } catch (err) {
        console.error(`Error processing account ${account.ID}:`, err);
        results.skipped++;
      }
    }

    const nextLink = responseData.d?.__next;
    if (nextLink && accounts.length > 0) {
      nextPageUrl = nextLink;
    } else {
      hasMore = false;
    }
  }

  return results;
}

function mapToExactAccount(customer: AbitareCustomer): ExactAccount {
  let name = customer.last_name;
  if (customer.customer_type === "zakelijk" && customer.company_name) {
    name = customer.company_name;
  } else if (customer.first_name) {
    name = `${customer.first_name} ${customer.last_name}`;
  }

  return {
    Code: customer.customer_number.toString(),
    Name: name,
    Email: customer.email || undefined,
    Phone: customer.phone || customer.mobile || undefined,
    AddressLine1: customer.street_address || undefined,
    City: customer.city || undefined,
    Postcode: customer.postal_code || undefined,
    Country: customer.country === "Nederland" ? "NL" : customer.country || undefined,
    VATNumber: customer.vat_number || undefined,
    ChamberOfCommerce: customer.coc_number || undefined,
    Status: "C",
  };
}

function mapFromExactAccount(account: ExactAccount): Partial<AbitareCustomer> {
  return {
    last_name: account.Name || "Onbekend",
    email: account.Email || null,
    phone: account.Phone || null,
    street_address: account.AddressLine1 || null,
    city: account.City || null,
    postal_code: account.Postcode || null,
    country: account.Country === "NL" ? "Nederland" : account.Country || null,
    vat_number: account.VATNumber || null,
    coc_number: account.ChamberOfCommerce || null,
  };
}
