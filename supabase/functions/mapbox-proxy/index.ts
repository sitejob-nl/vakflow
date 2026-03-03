import { corsHeaders } from "../_shared/cors.ts";
import { createAdminClient, authenticateRequest, AuthError } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await authenticateRequest(req);

    const MAPBOX_ACCESS_TOKEN = Deno.env.get("MAPBOX_ACCESS_TOKEN");
    if (!MAPBOX_ACCESS_TOKEN) {
      return new Response(
        JSON.stringify({ error: "Service niet geconfigureerd", code: "MAPBOX_CONFIG" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, query, from, to } = await req.json();

    if (!action || typeof action !== "string") {
      return new Response(JSON.stringify({ error: "Missing action" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "geocode") {
      if (!query || typeof query !== "string" || query.length > 200) {
        return new Response(JSON.stringify({ error: "Invalid query (max 200 chars)" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!/^[\p{L}\p{N}\s,.\-'/()#]+$/u.test(query)) {
        return new Response(JSON.stringify({ error: "Ongeldige tekens in zoekopdracht" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_ACCESS_TOKEN}&country=nl&language=nl&types=address&limit=5`;
      const res = await fetch(url);
      const data = await res.json();

      const results = (data.features ?? []).map((f: any) => {
        const ctx = (key: string) => f.context?.find((c: any) => c.id?.startsWith(key))?.text ?? "";
        return {
          place_name: f.place_name,
          street: f.text ?? "",
          house_number: f.address ?? "",
          postal_code: ctx("postcode"),
          city: ctx("place"),
          lat: f.center?.[1] ?? null,
          lng: f.center?.[0] ?? null,
        };
      });

      return new Response(JSON.stringify(results), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${fromLng},${fromLat};${toLng},${toLat}?access_token=${MAPBOX_ACCESS_TOKEN}&overview=false`;
      const res = await fetch(url);
      const data = await res.json();
      const route = data.routes?.[0];

      return new Response(
        JSON.stringify({
          duration_minutes: route ? Math.round(route.duration / 60) : null,
          distance_km: route ? Math.round((route.distance / 1000) * 10) / 10 : null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
    console.error("Mapbox proxy error:", err);
    return new Response(JSON.stringify({ error: "Interne fout", code: "MAPBOX_ERROR" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});