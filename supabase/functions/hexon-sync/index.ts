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
    const { company_id, trade_vehicle_id, action } = await req.json();

    if (!company_id || !trade_vehicle_id) {
      return new Response(JSON.stringify({ error: "Missing company_id or trade_vehicle_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Hexon config
    const { data: hexonConfig, error: configError } = await supabase
      .from("hexon_config")
      .select("*")
      .eq("company_id", company_id)
      .eq("status", "active")
      .single();

    if (configError || !hexonConfig) {
      return new Response(JSON.stringify({ error: "No active Hexon config" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get trade vehicle with all data
    const { data: vehicle, error: vehicleError } = await supabase
      .from("trade_vehicles")
      .select("*")
      .eq("id", trade_vehicle_id)
      .eq("company_id", company_id)
      .single();

    if (vehicleError || !vehicle) {
      return new Response(JSON.stringify({ error: "Vehicle not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hexonApi = new HexonAPI(hexonConfig);

    // Determine action based on vehicle status or explicit action
    const syncAction = action || getActionFromStatus(vehicle.status);

    let result;
    switch (syncAction) {
      case "publish":
        result = await publishVehicle(supabase, hexonApi, hexonConfig, vehicle);
        break;
      case "update":
        result = await updateVehicle(supabase, hexonApi, hexonConfig, vehicle);
        break;
      case "unpublish":
        result = await unpublishVehicle(supabase, hexonApi, hexonConfig, vehicle);
        break;
      case "fetch_status":
        result = await fetchAdStatus(supabase, hexonApi, hexonConfig, vehicle);
        break;
      default:
        result = { error: `Unknown action: ${syncAction}` };
    }

    return new Response(JSON.stringify(result), {
      status: result.error ? 400 : 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("hexon-sync error:", err);
    return new Response(JSON.stringify({ error: "Internal error", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getActionFromStatus(status: string): string {
  switch (status) {
    case "foto_klaar":
    case "online":
      return "publish";
    case "verkocht":
    case "afgeleverd":
    case "gearchiveerd":
      return "unpublish";
    default:
      return "update";
  }
}

// Hexon API wrapper
class HexonAPI {
  private baseUrl: string;
  private apiKey: string;
  private publication: string;

  constructor(config: any) {
    this.baseUrl = config.api_url;
    this.apiKey = config.api_key;
    this.publication = config.publication;
  }

  async request(path: string, method = "GET", body?: any) {
    const url = `${this.baseUrl}/${this.publication}/rest${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Basic ${btoa(`${this.apiKey}:`)}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Hexon API ${method} ${path}: ${res.status} - ${errorText}`);
    }

    return res.json();
  }

  async getVehicle(stocknumber: string) {
    return this.request(`/vehicle/${stocknumber}`);
  }

  async getAds(stocknumber: string) {
    return this.request(`/vehicle/${stocknumber}/ads/`);
  }

  async getAd(stocknumber: string, siteCode: string) {
    return this.request(`/ad/${stocknumber}:${siteCode}`);
  }

  async shareVehicle(stocknumber: string, siteCodes: string[]) {
    return this.request(`/vehicles/${stocknumber}/share`, "POST", {
      site_codes: siteCodes,
    });
  }

  async createDescription(stocknumber: string) {
    return this.request(`/vehicles/${stocknumber}/createdescription`, "POST", {});
  }
}

// Map trade_vehicle to Hexon vehicle properties
function mapVehicleToHexon(vehicle: any) {
  const rdw = vehicle.rdw_data || {};
  return {
    stocknumber: vehicle.hexon_stocknumber,
    general: {
      make: vehicle.brand,
      model: vehicle.model,
      type_trim_level: rdw.handelsbenaming || null,
    },
    condition: {
      odometer: { value: vehicle.mileage, unit: "km" },
      state: { general: vehicle.condition_score ? `${vehicle.condition_score}/10` : null },
    },
    body: {
      colour: { primary: vehicle.color },
    },
    powertrain: {
      engine: {
        energy: { type: vehicle.fuel_type },
      },
      transmission: { type: vehicle.transmission },
    },
    sales_conditions: {
      pricing: {
        consumer_local: { amount: vehicle.target_sell_price },
        trade_local: { amount: vehicle.price_trade },
        procurement: { amount: vehicle.purchase_price },
      },
      warranty: {
        months: vehicle.warranty_months,
      },
    },
    description: {
      remarks: vehicle.description_nl,
      highlights: vehicle.description_highlights,
    },
    history: {
      registration_date: vehicle.year ? `${vehicle.year}-01-01` : null,
    },
    region_specific: {
      nl: {
        bpm_amount: vehicle.bpm_amount,
        nap_weblabel: { status: vehicle.nap_weblabel_status },
      },
    },
  };
}

async function publishVehicle(supabase: any, api: HexonAPI, config: any, vehicle: any) {
  const stocknumber = vehicle.hexon_stocknumber;
  if (!stocknumber) {
    return { error: "Vehicle has no hexon_stocknumber" };
  }

  // Share to configured portals
  const siteCodes = config.default_site_codes || [];
  if (siteCodes.length === 0) {
    return { error: "No site codes configured" };
  }

  try {
    await api.shareVehicle(stocknumber, siteCodes);
  } catch (e) {
    console.error("Share failed:", e);
    return { error: `Share failed: ${e.message}` };
  }

  // Fetch ad status for each portal and upsert listings
  const listings = [];
  for (const siteCode of siteCodes) {
    try {
      const ad = await api.getAd(stocknumber, siteCode);
      const listing = {
        company_id: config.company_id,
        trade_vehicle_id: vehicle.id,
        stocknumber,
        site_code: siteCode,
        status: mapAdStatus(ad.status_code),
        status_message: ad.status_message?.value || null,
        deeplink_url: ad.deeplinks?.consumer || null,
        errors: ad.errors || [],
        warnings: ad.warnings || [],
        last_synced_at: new Date().toISOString(),
      };

      await supabase
        .from("hexon_listings")
        .upsert(listing, { onConflict: "company_id,stocknumber,site_code" });

      listings.push(listing);
    } catch (e) {
      console.error(`Failed to fetch ad status for ${siteCode}:`, e);
    }
  }

  return { success: true, listings };
}

async function updateVehicle(supabase: any, api: HexonAPI, config: any, vehicle: any) {
  // Re-fetch ad statuses
  return fetchAdStatus(supabase, api, config, vehicle);
}

async function unpublishVehicle(supabase: any, api: HexonAPI, config: any, vehicle: any) {
  const stocknumber = vehicle.hexon_stocknumber;
  if (!stocknumber) return { error: "No hexon_stocknumber" };

  // Share with empty site codes = unpublish
  try {
    await api.shareVehicle(stocknumber, []);
  } catch (e) {
    console.error("Unpublish failed:", e);
  }

  // Mark all listings as offline
  await supabase
    .from("hexon_listings")
    .update({ status: "offline", updated_at: new Date().toISOString() })
    .eq("trade_vehicle_id", vehicle.id);

  return { success: true, action: "unpublished" };
}

async function fetchAdStatus(supabase: any, api: HexonAPI, config: any, vehicle: any) {
  const stocknumber = vehicle.hexon_stocknumber;
  if (!stocknumber) return { error: "No hexon_stocknumber" };

  try {
    const adsResponse = await api.getAds(stocknumber);
    const ads = adsResponse?.items || adsResponse || [];

    for (const ad of ads) {
      await supabase.from("hexon_listings").upsert(
        {
          company_id: config.company_id,
          trade_vehicle_id: vehicle.id,
          stocknumber,
          site_code: ad.site_code,
          status: mapAdStatus(ad.status_code),
          status_message: ad.status_message?.value || null,
          deeplink_url: ad.deeplinks?.consumer || null,
          errors: ad.errors || [],
          warnings: ad.warnings || [],
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "company_id,stocknumber,site_code" }
      );
    }

    return { success: true, ads_count: ads.length };
  } catch (e) {
    return { error: `Failed to fetch ads: ${e.message}` };
  }
}

function mapAdStatus(statusCode: string): string {
  const map: Record<string, string> = {
    online: "online",
    pending: "pending",
    denied: "denied",
    error: "error",
    queued: "pending",
    processing: "pending",
    offline: "offline",
  };
  return map[statusCode?.toLowerCase()] || "pending";
}
