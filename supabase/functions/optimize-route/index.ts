import { corsHeaders, jsonRes, optionsResponse } from "../_shared/cors.ts";
import { createAdminClient, authenticateRequest, AuthError } from "../_shared/supabase.ts";
import { logEdgeFunctionError } from "../_shared/error-logger.ts";
import { decrypt } from "../_shared/crypto.ts";

const FUNCTION_NAME = "optimize-route";

interface WaypointInfo {
  appointmentId: string;
  type: "vakflow" | "outlook";
  lat: number;
  lng: number;
  label: string;
  pinned: boolean;
  scheduledAt?: string;
}

async function getOutlookAccessToken(refreshToken: string): Promise<string> {
  const clientId = Deno.env.get("OUTLOOK_CLIENT_ID");
  const tenantId = Deno.env.get("OUTLOOK_TENANT_ID") || "common";
  const clientSecret = Deno.env.get("OUTLOOK_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Outlook credentials missing");

  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      scope: "https://graph.microsoft.com/Calendars.ReadWrite offline_access",
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description);
  return data.access_token;
}

async function fetchOutlookEvents(admin: any, companyId: string, targetUser: string | null, date: string) {
  const events: WaypointInfo[] = [];

  // Get tokens: personal for target user, or company
  const tokens: { token: string; source: string }[] = [];

  if (targetUser) {
    const { data: userToken } = await admin
      .from("user_outlook_tokens")
      .select("outlook_refresh_token")
      .eq("user_id", targetUser)
      .single();
    if (userToken?.outlook_refresh_token) {
      try {
        const decrypted = await decrypt(userToken.outlook_refresh_token);
        const accessToken = await getOutlookAccessToken(decrypted);
        tokens.push({ token: accessToken, source: "personal" });
      } catch (e) {
        console.error("Personal token refresh failed:", e);
      }
    }
  }

  // Also try company token
  const { data: company } = await admin
    .from("companies")
    .select("outlook_refresh_token")
    .eq("id", companyId)
    .single();
  if (company?.outlook_refresh_token) {
    try {
      const decrypted = await decrypt(company.outlook_refresh_token);
      const accessToken = await getOutlookAccessToken(decrypted);
      tokens.push({ token: accessToken, source: "company" });
    } catch (e) {
      console.error("Company token refresh failed:", e);
    }
  }

  if (tokens.length === 0) return events;

  const startDT = `${date}T00:00:00`;
  const endDT = `${date}T23:59:59`;
  const calendarUrl = `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${encodeURIComponent(startDT)}&endDateTime=${encodeURIComponent(endDT)}&$orderby=start/dateTime&$top=50&$select=id,subject,start,end,location,isAllDay`;

  // Fetch overrides for this company
  const { data: overrides } = await admin
    .from("outlook_event_overrides")
    .select("outlook_event_id, pinned, lat, lng, location_override")
    .eq("company_id", companyId);
  const overrideMap = new Map((overrides ?? []).map((o: any) => [o.outlook_event_id, o]));

  const seenIds = new Set<string>();

  for (const { token } of tokens) {
    try {
      const res = await fetch(calendarUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) continue;
      const data = await res.json();

      for (const ev of (data.value || [])) {
        if (seenIds.has(ev.id) || ev.isAllDay) continue;
        seenIds.add(ev.id);

        const override = overrideMap.get(ev.id);
        const lat = override?.lat ? Number(override.lat) : null;
        const lng = override?.lng ? Number(override.lng) : null;
        const pinned = override?.pinned ?? false;

        // Only include if we have coordinates (from override)
        if (lat && lng) {
          events.push({
            appointmentId: ev.id,
            type: "outlook",
            lat,
            lng,
            label: ev.subject || override?.location_override || "Outlook event",
            pinned,
            scheduledAt: ev.start?.dateTime,
          });
        }
      }
    } catch (e) {
      console.error("Outlook fetch error:", e);
    }
  }

  return events;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  try {
    const { userId, companyId } = await authenticateRequest(req);
    const body = await req.json();
    const { date, assigned_to, round_trip = true, include_outlook = true } = body as {
      date: string;
      assigned_to?: string;
      round_trip?: boolean;
      include_outlook?: boolean;
    };

    if (!date) return jsonRes({ error: "date is verplicht" }, 400);

    const targetUser = assigned_to || null;
    const dayStart = `${date}T00:00:00+01:00`;
    const dayEnd = `${date}T23:59:59+01:00`;
    const admin = createAdminClient();

    // Fetch Vakflow appointments
    let query = admin
      .from("appointments")
      .select("id, scheduled_at, duration_minutes, address_id, customer_id, status")
      .eq("company_id", companyId)
      .gte("scheduled_at", dayStart)
      .lte("scheduled_at", dayEnd)
      .neq("status", "geannuleerd")
      .order("scheduled_at");

    if (targetUser) query = query.eq("assigned_to", targetUser);

    const { data: appointments, error: apptErr } = await query;
    if (apptErr) throw apptErr;

    // Collect coordinates for Vakflow appointments
    const addressIds = (appointments ?? []).map((a) => a.address_id).filter(Boolean) as string[];
    const customerIds = (appointments ?? []).map((a) => a.customer_id);

    const [addressRes, customerRes] = await Promise.all([
      addressIds.length > 0
        ? admin.from("addresses").select("id, lat, lng, street, city").in("id", addressIds)
        : Promise.resolve({ data: [], error: null }),
      admin.from("customers").select("id, lat, lng, name, address, city").in("id", customerIds),
    ]);

    const addressMap = new Map((addressRes.data ?? []).map((a: any) => [a.id, a]));
    const customerMap = new Map((customerRes.data ?? []).map((c: any) => [c.id, c]));

    const waypoints: WaypointInfo[] = [];
    const skipped: string[] = [];

    for (const appt of (appointments ?? [])) {
      let lat: number | null = null;
      let lng: number | null = null;
      let label = "";

      if (appt.address_id && addressMap.has(appt.address_id)) {
        const addr = addressMap.get(appt.address_id)!;
        lat = addr.lat;
        lng = addr.lng;
        label = [addr.street, addr.city].filter(Boolean).join(", ");
      }

      if ((!lat || !lng) && customerMap.has(appt.customer_id)) {
        const cust = customerMap.get(appt.customer_id)!;
        lat = cust.lat;
        lng = cust.lng;
        label = cust.name ?? [cust.address, cust.city].filter(Boolean).join(", ");
      }

      if (lat && lng) {
        waypoints.push({
          appointmentId: appt.id,
          type: "vakflow",
          lat: Number(lat),
          lng: Number(lng),
          label,
          pinned: false,
          scheduledAt: appt.scheduled_at,
        });
      } else {
        skipped.push(appt.id);
      }
    }

    // Fetch Outlook events with locations
    let outlookEvents: WaypointInfo[] = [];
    if (include_outlook) {
      try {
        outlookEvents = await fetchOutlookEvents(admin, companyId, targetUser, date);
        waypoints.push(...outlookEvents);
      } catch (e) {
        console.error("Outlook events fetch failed (non-blocking):", e);
      }
    }

    if (waypoints.length < 2) {
      return jsonRes({ error: "Minimaal 2 afspraken nodig voor optimalisatie", appointments_count: waypoints.length }, 400);
    }

    // Separate pinned and movable waypoints
    const pinnedWaypoints = waypoints.filter((wp) => wp.pinned);
    const movableWaypoints = waypoints.filter((wp) => !wp.pinned);

    // Get company address as origin
    const { data: companyData } = await admin
      .from("companies")
      .select("address, postal_code, city")
      .eq("id", companyId)
      .single();

    const companyAddress = companyData
      ? [companyData.address, companyData.postal_code, companyData.city].filter(Boolean).join(", ")
      : null;

    // Build Google Routes API request
    const apiKey = Deno.env.get("GOOGLE_ROUTES_API_KEY");
    if (!apiKey) throw new Error("GOOGLE_ROUTES_API_KEY niet geconfigureerd");

    const origin = companyAddress
      ? { address: companyAddress }
      : { location: { latLng: { latitude: waypoints[0].lat, longitude: waypoints[0].lng } } };

    const destination = round_trip
      ? origin
      : { location: { latLng: { latitude: waypoints[waypoints.length - 1].lat, longitude: waypoints[waypoints.length - 1].lng } } };

    // All waypoints as intermediates (Google will optimize their order)
    const intermediates = waypoints.map((wp) => ({
      location: { latLng: { latitude: wp.lat, longitude: wp.lng } },
    }));

    const routeRequest = {
      origin,
      destination,
      intermediates,
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
      const leg = legs[legIdx];
      const durationStr = leg?.duration ?? "0s";
      const durationSeconds = parseInt(durationStr.replace("s", ""), 10) || 0;
      const distanceMeters = leg?.distanceMeters ?? 0;

      return {
        appointment_id: wp.appointmentId,
        type: wp.type,
        label: wp.label,
        lat: wp.lat,
        lng: wp.lng,
        pinned: wp.pinned,
        travel_time_minutes: Math.round(durationSeconds / 60),
        distance_km: Math.round(distanceMeters / 100) / 10,
        original_index: waypointIdx,
      };
    });

    // Summary
    const totalTravelMin = stops.reduce((s, st) => s + st.travel_time_minutes, 0);
    const totalDistanceKm = stops.reduce((s, st) => s + st.distance_km, 0);

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
        outlook_count: outlookEvents.length,
        pinned_count: pinnedWaypoints.length,
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
