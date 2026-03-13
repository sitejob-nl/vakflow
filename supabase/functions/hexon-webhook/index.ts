import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const payload = await req.json();

    // Hexon event webhook payload
    const { event_type, stocknumber, site_code, data } = payload;

    if (!stocknumber) {
      return new Response(JSON.stringify({ error: "Missing stocknumber" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the listing by stocknumber
    const { data: listing } = await supabase
      .from("hexon_listings")
      .select("*, trade_vehicles!inner(id, company_id, brand, model, license_plate)")
      .eq("stocknumber", stocknumber)
      .eq("site_code", site_code || "")
      .maybeSingle();

    // If no specific listing, find by stocknumber only
    const { data: anyListing } = !listing
      ? await supabase
          .from("hexon_listings")
          .select("*, trade_vehicles!inner(id, company_id, brand, model, license_plate)")
          .eq("stocknumber", stocknumber)
          .limit(1)
          .maybeSingle()
      : { data: listing };

    const targetListing = listing || anyListing;

    if (!targetListing) {
      console.log("No listing found for stocknumber:", stocknumber);
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const companyId = targetListing.trade_vehicles.company_id;

    switch (event_type) {
      case "ad.status.changed": {
        const newStatus = data?.status_code?.toLowerCase() || "pending";
        const updates: Record<string, any> = {
          status: mapStatus(newStatus),
          status_message: data?.status_message || null,
          deeplink_url: data?.deeplinks?.consumer || targetListing.deeplink_url,
          errors: data?.errors || [],
          warnings: data?.warnings || [],
          updated_at: new Date().toISOString(),
          last_synced_at: new Date().toISOString(),
        };

        await supabase
          .from("hexon_listings")
          .update(updates)
          .eq("id", targetListing.id);

        // Notify on errors
        if (updates.status === "denied" || updates.status === "error") {
          await createNotification(supabase, companyId, {
            title: `Hexon: advertentie ${updates.status}`,
            body: `${targetListing.trade_vehicles.brand} ${targetListing.trade_vehicles.model} (${stocknumber}) op ${site_code}: ${updates.status_message || "Onbekende fout"}`,
            link_page: "trade-vehicles",
            link_params: { id: targetListing.trade_vehicles.id, tab: "hexon" },
          });
        }
        break;
      }

      case "ad.online": {
        await supabase
          .from("hexon_listings")
          .update({
            status: "online",
            deeplink_url: data?.deeplink || data?.deeplinks?.consumer || null,
            updated_at: new Date().toISOString(),
            last_synced_at: new Date().toISOString(),
          })
          .eq("id", targetListing.id);
        break;
      }

      case "ad.denied": {
        await supabase
          .from("hexon_listings")
          .update({
            status: "denied",
            status_message: data?.denied_reason || null,
            errors: data?.errors || [],
            updated_at: new Date().toISOString(),
            last_synced_at: new Date().toISOString(),
          })
          .eq("id", targetListing.id);

        await createNotification(supabase, companyId, {
          title: "Hexon: advertentie geweigerd",
          body: `${targetListing.trade_vehicles.brand} ${targetListing.trade_vehicles.model} op ${site_code}: ${data?.denied_reason || "Reden onbekend"}`,
          link_page: "trade-vehicles",
          link_params: { id: targetListing.trade_vehicles.id, tab: "hexon" },
        });
        break;
      }

      default:
        console.log("Unknown event_type:", event_type);
    }

    return new Response(JSON.stringify({ success: true, event_type }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("hexon-webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function mapStatus(code: string): string {
  const map: Record<string, string> = {
    online: "online",
    pending: "pending",
    denied: "denied",
    error: "error",
    queued: "pending",
    processing: "pending",
    offline: "offline",
  };
  return map[code] || "pending";
}

async function createNotification(
  supabase: any,
  companyId: string,
  notification: { title: string; body: string; link_page: string; link_params: any }
) {
  // Get first admin of company
  const { data: admins } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("company_id", companyId)
    .eq("role", "admin")
    .limit(1);

  if (admins && admins.length > 0) {
    await supabase.from("notifications").insert({
      company_id: companyId,
      user_id: admins[0].user_id,
      ...notification,
    });
  }
}
