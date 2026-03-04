import { jsonRes, optionsResponse } from "../_shared/cors.ts";
import { createAdminClient, authenticateRequest, AuthError } from "../_shared/supabase.ts";
import { getConnectionForCompany, snelstartFetch, snelstartGetAll } from "../_shared/snelstart-client.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  try {
    const { companyId } = await authenticateRequest(req);
    const admin = createAdminClient();
    const conn = await getConnectionForCompany(admin, companyId);
    if (!conn) return jsonRes({ error: "Geen SnelStart koppeling gevonden" }, 404);

    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    switch (req.method) {
      case "GET": {
        if (id) {
          const data = await snelstartFetch(admin, conn, `/relaties/${id}`);
          return jsonRes(data);
        }
        const filter = url.searchParams.get("filter") || undefined;
        const data = await snelstartGetAll(admin, conn, "/relaties", filter);
        return jsonRes(data);
      }
      case "POST": {
        const body = await req.json();
        const data = await snelstartFetch(admin, conn, "/relaties", "POST", body);
        return jsonRes(data, 201);
      }
      case "PUT": {
        if (!id) return jsonRes({ error: "id is required" }, 400);
        const body = await req.json();
        const data = await snelstartFetch(admin, conn, `/relaties/${id}`, "PUT", body);
        return jsonRes(data);
      }
      case "DELETE": {
        if (!id) return jsonRes({ error: "id is required" }, 400);
        await snelstartFetch(admin, conn, `/relaties/${id}`, "DELETE");
        return jsonRes({ ok: true });
      }
      default:
        return jsonRes({ error: "Method not allowed" }, 405);
    }
  } catch (err: any) {
    if (err instanceof AuthError) return jsonRes({ error: err.message }, err.status);
    console.error("snelstart-relaties error:", err);
    return jsonRes({ error: err.message || "Internal error" }, 500);
  }
});
