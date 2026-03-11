import { corsHeaders, jsonRes, optionsResponse } from "../_shared/cors.ts";
import { createAdminClient, authenticateRequest, AuthError } from "../_shared/supabase.ts";
import { getExactTokenFromConnection } from "../_shared/exact-connect.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);

  try {
    await authenticateRequest(req);
    const admin = createAdminClient();
    const { divisionId, endpoint, method = "GET", body } = await req.json();

    if (!divisionId || !endpoint) throw new Error("divisionId and endpoint are required");

    const { data: connection, error: connError } = await admin
      .from("exact_online_connections")
      .select("*")
      .eq("division_id", divisionId)
      .eq("is_active", true)
      .single();

    if (connError || !connection) throw new Error("Geen actieve Exact Online verbinding gevonden");

    const tokenData = await getExactTokenFromConnection(connection);
    const exactEndpoint = endpoint.replace("{division}", tokenData.division.toString());
    const exactUrl = `${tokenData.base_url}${exactEndpoint}`;

    const exactResponse = await fetch(exactUrl, {
      method,
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!exactResponse.ok) {
      const errorText = await exactResponse.text();
      throw new Error(`Exact API error: ${exactResponse.status} - ${errorText}`);
    }

    const data = await exactResponse.json();
    return jsonRes(data, 200, req);
  } catch (err: any) {
    if (err instanceof AuthError) return jsonRes({ error: err.message }, err.status, req);
    console.error("exact-api error:", err);
    return jsonRes({ error: err.message || "Internal error" }, 500, req);
  }
});
