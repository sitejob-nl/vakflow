import { corsHeaders } from "../_shared/cors.ts";
import { authenticateRequest, AuthError } from "../_shared/supabase.ts";

function extractComponent(components: any[], type: string): string {
  return components?.find((c: any) => c.types?.includes(type))?.long_name ?? "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await authenticateRequest(req);

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_ROUTES_API_KEY");
    if (!GOOGLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Service niet geconfigureerd", code: "GOOGLE_CONFIG" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, query, from, to } = await req.json();

    if (!action || typeof action !== "string") {
      return new Response(JSON.stringify({ error: "Missing action" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    /* ── geocode ─────────────────────────────────────────── */
    if (action === "geocode") {
      if (!query || typeof query !== "string" || query.length > 200) {
        return new Response(JSON.stringify({ error: "Invalid query (max 200 chars)" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&region=nl&language=nl&key=${GOOGLE_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();

      const results = (data.results ?? []).slice(0, 5).map((r: any) => {
        const comps = r.address_components ?? [];
        const street = extractComponent(comps, "route");
        const house_number = extractComponent(comps, "street_number");
        const postal_code = extractComponent(comps, "postal_code");
        const city = extractComponent(comps, "locality") || extractComponent(comps, "administrative_area_level_2");

        return {
          place_name: r.formatted_address ?? "",
          street,
          house_number,
          postal_code,
          city,
          lat: r.geometry?.location?.lat ?? null,
          lng: r.geometry?.location?.lng ?? null,
        };
      });

      return new Response(JSON.stringify(results), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    /* ── directions ──────────────────────────────────────── */
    if (action === "directions") {
      if (!Array.isArray(from) || from.length !== 2 || !Array.isArray(to) || to.length !== 2) {
        return new Response(JSON.stringify({ error: "Invalid from/to coordinates" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const [fromLat, fromLng] = from;
      const [toLat, toLng] = to;
      if ([fromLat, fromLng, toLat, toLng].some((v) => typeof v !== "number" || v < -180 || v > 180)) {
        return new Response(JSON.stringify({ error: "Coordinates out of range" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const routeRes = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_API_KEY,
          "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
        },
        body: JSON.stringify({
          origin: { location: { latLng: { latitude: fromLat, longitude: fromLng } } },
          destination: { location: { latLng: { latitude: toLat, longitude: toLng } } },
          travelMode: "DRIVE",
          routingPreference: "TRAFFIC_AWARE",
        }),
      });
      const routeData = await routeRes.json();
      const route = routeData.routes?.[0];

      const durationSec = route?.duration ? parseInt(route.duration.replace("s", ""), 10) : null;

      return new Response(
        JSON.stringify({
          duration_minutes: durationSec != null ? Math.round(durationSec / 60) : null,
          distance_km: route?.distanceMeters != null ? Math.round((route.distanceMeters / 1000) * 10) / 10 : null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    /* ── get-key (publishable, restricted by referrer) ── */
    if (action === "get-key") {
      return new Response(JSON.stringify({ key: GOOGLE_API_KEY }), {
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "private, max-age=3600" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: err.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.error("Google Maps proxy error:", err);
    return new Response(JSON.stringify({ error: "Interne fout", code: "GOOGLE_MAPS_ERROR" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
