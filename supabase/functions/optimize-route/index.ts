import { corsHeaders, jsonRes, optionsResponse } from "../_shared/cors.ts";
import { createAdminClient, authenticateRequest, AuthError } from "../_shared/supabase.ts";
import { logEdgeFunctionError } from "../_shared/error-logger.ts";

const FUNCTION_NAME = "optimize-route";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  try {
    const { userId, companyId } = await authenticateRequest(req);
    const body = await req.json();
    const { date, assigned_to, round_trip = true } = body as {
      date: string;
      assigned_to?: string;
      round_trip?: boolean;
    };

    if (!date) return jsonRes({ error: "date is verplicht" }, 400);

    const targetUser = assigned_to || null;
    const dayStart = `${date}T00:00:00+01:00`;
    const dayEnd = `${date}T23:59:59+01:00`;

    const admin = createAdminClient();

    // Fetch appointments for that day (optionally filtered by employee)
    let query = admin
      .from("appointments")
      .select("id, scheduled_at, duration_minutes, address_id, customer_id, status")
      .eq("company_id", companyId)
      .gte("scheduled_at", dayStart)
      .lte("scheduled_at", dayEnd)
      .neq("status", "geannuleerd")
      .order("scheduled_at");

    if (targetUser) {
      query = query.eq("assigned_to", targetUser);
    }

    const { data: appointments, error: apptErr } = await query;

    if (apptErr) throw apptErr;
    if (!appointments || appointments.length < 2) {
      return jsonRes({ error: "Minimaal 2 afspraken nodig voor optimalisatie", appointments_count: appointments?.length ?? 0 }, 400);
    }

    // Collect coordinates: prefer address, fallback to customer
    const addressIds = appointments.map((a) => a.address_id).filter(Boolean) as string[];
    const customerIds = appointments.map((a) => a.customer_id);

    const [addressRes, customerRes] = await Promise.all([
      addressIds.length > 0
        ? admin.from("addresses").select("id, lat, lng, street, city").in("id", addressIds)
        : Promise.resolve({ data: [], error: null }),
      admin.from("customers").select("id, lat, lng, name, address, city").in("id", customerIds),
    ]);

    const addressMap = new Map((addressRes.data ?? []).map((a) => [a.id, a]));
    const customerMap = new Map((customerRes.data ?? []).map((c) => [c.id, c]));

    // Build waypoints
    interface WaypointInfo {
      appointmentId: string;
      lat: number;
      lng: number;
      label: string;
    }

    const waypoints: WaypointInfo[] = [];
    const skipped: string[] = [];

    for (const appt of appointments) {
      let lat: number | null = null;
      let lng: number | null = null;
      let label = "";

      // Try address first
      if (appt.address_id && addressMap.has(appt.address_id)) {
        const addr = addressMap.get(appt.address_id)!;
        lat = addr.lat;
        lng = addr.lng;
        label = [addr.street, addr.city].filter(Boolean).join(", ");
      }

      // Fallback to customer
      if ((!lat || !lng) && customerMap.has(appt.customer_id)) {
        const cust = customerMap.get(appt.customer_id)!;
        lat = cust.lat;
        lng = cust.lng;
        label = cust.name ?? [cust.address, cust.city].filter(Boolean).join(", ");
      }

      if (lat && lng) {
        waypoints.push({ appointmentId: appt.id, lat: Number(lat), lng: Number(lng), label });
      } else {
        skipped.push(appt.id);
      }
    }

    if (waypoints.length < 2) {
      return jsonRes({ error: "Niet genoeg afspraken met coördinaten", skipped }, 400);
    }

    // Get company address as origin
    const { data: company } = await admin
      .from("companies")
      .select("address, postal_code, city")
      .eq("id", companyId)
      .single();

    const companyAddress = company
      ? [company.address, company.postal_code, company.city].filter(Boolean).join(", ")
      : null;

    // Build Google Routes API request
    const apiKey = Deno.env.get("GOOGLE_ROUTES_API_KEY");
    if (!apiKey) throw new Error("GOOGLE_ROUTES_API_KEY niet geconfigureerd");

    // Origin = company address (text) or first waypoint
    const origin = companyAddress
      ? { address: companyAddress }
      : { location: { latLng: { latitude: waypoints[0].lat, longitude: waypoints[0].lng } } };

    // Destination = same as origin if round_trip, otherwise last waypoint
    const destination = round_trip
      ? origin
      : { location: { latLng: { latitude: waypoints[waypoints.length - 1].lat, longitude: waypoints[waypoints.length - 1].lng } } };

    // All waypoints are intermediates
    const intermediates = waypoints.map((wp) => ({
      location: { latLng: { latitude: wp.lat, longitude: wp.lng } },
    }));

    const routeRequest = {
      origin: { waypoint: origin },
      destination: { waypoint: destination },
      intermediates: intermediates.map((i) => ({ waypoint: i })),
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      optimizeWaypointOrder: true,
    };

    const fieldMask = [
      "routes.optimizedIntermediateWaypointIndex",
      "routes.legs.duration",
      "routes.legs.distanceMeters",
    ].join(",");

    const googleRes = await fetch(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": fieldMask,
        },
        body: JSON.stringify(routeRequest),
      }
    );

    const googleData = await googleRes.json();

    if (!googleRes.ok) {
      console.error("Google Routes API error:", JSON.stringify(googleData));
      await logEdgeFunctionError(admin, FUNCTION_NAME, `Google API ${googleRes.status}`, googleData, companyId);
      return jsonRes({ error: "Google Routes API fout", details: googleData.error?.message ?? "Onbekend" }, 502);
    }

    const route = googleData.routes?.[0];
    if (!route) {
      return jsonRes({ error: "Geen route gevonden" }, 404);
    }

    const optimizedOrder: number[] = route.optimizedIntermediateWaypointIndex ?? waypoints.map((_, i) => i);
    const legs = route.legs ?? [];

    // Build optimized stops
    const stops = optimizedOrder.map((waypointIdx, legIdx) => {
      const wp = waypoints[waypointIdx];
      // leg[0] = origin → first intermediate, leg[i+1] for subsequent
      // legs array: leg[0] = origin->first, leg[1] = first->second, ...
      // The leg leading TO this waypoint is legs[legIdx] (which is origin->wp for first, prev_wp->wp for rest)
      const leg = legs[legIdx]; // leg from previous stop to this stop
      const durationStr = leg?.duration ?? "0s";
      const durationSeconds = parseInt(durationStr.replace("s", ""), 10) || 0;
      const distanceMeters = leg?.distanceMeters ?? 0;

      return {
        appointment_id: wp.appointmentId,
        label: wp.label,
        lat: wp.lat,
        lng: wp.lng,
        travel_time_minutes: Math.round(durationSeconds / 60),
        distance_km: Math.round(distanceMeters / 100) / 10,
        original_index: waypointIdx,
      };
    });

    // Summary: total travel
    const totalTravelMin = stops.reduce((s, st) => s + st.travel_time_minutes, 0);
    const totalDistanceKm = stops.reduce((s, st) => s + st.distance_km, 0);

    // Add return leg if round_trip
    let returnLeg = null;
    if (round_trip && legs.length > optimizedOrder.length) {
      const lastLeg = legs[legs.length - 1];
      const dur = parseInt((lastLeg?.duration ?? "0s").replace("s", ""), 10) || 0;
      returnLeg = {
        travel_time_minutes: Math.round(dur / 60),
        distance_km: Math.round((lastLeg?.distanceMeters ?? 0) / 100) / 10,
      };
    }

    return jsonRes({
      stops,
      skipped,
      summary: {
        total_travel_minutes: totalTravelMin + (returnLeg?.travel_time_minutes ?? 0),
        total_distance_km: Math.round((totalDistanceKm + (returnLeg?.distance_km ?? 0)) * 10) / 10,
        return_leg: returnLeg,
        waypoint_count: waypoints.length,
        skipped_count: skipped.length,
      },
      company_origin: companyAddress,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonRes({ error: err.message }, err.status);
    }
    console.error("optimize-route error:", err);
    try {
      const admin = createAdminClient();
      await logEdgeFunctionError(admin, FUNCTION_NAME, (err as Error).message, {}, null);
    } catch {}
    return jsonRes({ error: (err as Error).message }, 500);
  }
});
