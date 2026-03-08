import { corsFor, jsonRes, optionsResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);

  try {
    const { plate } = await req.json();
    if (!plate) return jsonRes({ error: "plate is required" }, 400, req);

    // Normalize plate: uppercase, remove dashes/spaces
    const normalized = plate.replace(/[\s-]/g, "").toUpperCase();

    // RDW Open Data API — free, no API key
    const rdwUrl = `https://opendata.rdw.nl/resource/m9d7-ebf2.json?kenteken=${normalized}`;
    const resp = await fetch(rdwUrl);
    if (!resp.ok) return jsonRes({ error: "RDW API error" }, 502, req);

    const data = await resp.json();
    if (!data || data.length === 0) {
      return jsonRes({ found: false, plate: normalized }, 200, req);
    }

    const v = data[0];

    // Also fetch APK data from separate endpoint
    let apkExpiry: string | null = null;
    try {
      const apkUrl = `https://opendata.rdw.nl/resource/3huj-srit.json?kenteken=${normalized}`;
      const apkResp = await fetch(apkUrl);
      if (apkResp.ok) {
        const apkData = await apkResp.json();
        if (apkData?.length > 0) {
          // Get the latest APK record
          const sorted = apkData.sort((a: any, b: any) =>
            (b.vervaldatum_apk || "").localeCompare(a.vervaldatum_apk || "")
          );
          const raw = sorted[0].vervaldatum_apk;
          if (raw) {
            // Format: YYYYMMDD → YYYY-MM-DD
            apkExpiry = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
          }
        }
      }
    } catch {
      // APK lookup is optional
    }

    const result = {
      found: true,
      plate: normalized,
      brand: v.merk || null,
      model: v.handelsbenaming || null,
      build_year: v.datum_eerste_toelating
        ? parseInt(v.datum_eerste_toelating.slice(0, 4))
        : null,
      fuel_type: v.brandstof_omschrijving || null,
      color: v.eerste_kleur || null,
      vehicle_mass: v.massa_rijklaar ? parseInt(v.massa_rijklaar) : null,
      registration_date: v.datum_eerste_toelating
        ? `${v.datum_eerste_toelating.slice(0, 4)}-${v.datum_eerste_toelating.slice(4, 6)}-${v.datum_eerste_toelating.slice(6, 8)}`
        : null,
      apk_expiry_date: apkExpiry,
      raw: v,
    };

    return jsonRes(result, 200, req);
  } catch (err) {
    return jsonRes({ error: (err as Error).message }, 500, req);
  }
});
