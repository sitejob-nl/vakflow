import { corsFor, jsonRes, optionsResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);

  try {
    const { plate } = await req.json();
    if (!plate) return jsonRes({ error: "plate is required" }, 400, req);

    // Normalize plate: uppercase, remove dashes/spaces
    const normalized = plate.replace(/[\s-]/g, "").toUpperCase();

    // --- Main vehicle data (v3 API) ---
    const mainUrl = `https://opendata.rdw.nl/api/v3/views/m9d7-ebf2/query.json?$$query=${encodeURIComponent(`SELECT * WHERE kenteken='${normalized}'`)}`;
    const mainResp = await fetch(mainUrl);
    if (!mainResp.ok) return jsonRes({ error: "RDW API error" }, 502, req);

    const mainJson = await mainResp.json();
    const rows = mainJson?.rows ?? mainJson ?? [];
    if (!rows || rows.length === 0) {
      return jsonRes({ found: false, plate: normalized }, 200, req);
    }

    const v = rows[0];

    // --- Fuel data (separate linked dataset, SODA v2 — still works fine) ---
    let fuelType: string | null = null;
    try {
      const fuelUrl = `https://opendata.rdw.nl/resource/8ys7-d773.json?kenteken=${normalized}`;
      const fuelResp = await fetch(fuelUrl);
      if (fuelResp.ok) {
        const fuelData = await fuelResp.json();
        if (fuelData?.length > 0) {
          fuelType = fuelData[0].brandstof_omschrijving || null;
        }
      }
    } catch {
      // Fuel lookup is optional
    }

    // Parse APK expiry — prefer ISO timestamp field, fallback to number
    let apkExpiry: string | null = null;
    if (v.vervaldatum_apk_dt) {
      // ISO timestamp like "2025-06-15T00:00:00.000"
      apkExpiry = v.vervaldatum_apk_dt.slice(0, 10);
    } else if (v.vervaldatum_apk) {
      const raw = String(v.vervaldatum_apk);
      if (raw.length === 8) {
        apkExpiry = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
      }
    }

    // Parse first registration date
    let registrationDate: string | null = null;
    if (v.datum_eerste_toelating_dt) {
      registrationDate = v.datum_eerste_toelating_dt.slice(0, 10);
    } else if (v.datum_eerste_toelating) {
      const raw = String(v.datum_eerste_toelating);
      if (raw.length === 8) {
        registrationDate = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
      }
    }

    const result = {
      found: true,
      plate: normalized,
      brand: v.merk || null,
      model: v.handelsbenaming || null,
      build_year: v.datum_eerste_toelating
        ? parseInt(String(v.datum_eerste_toelating).slice(0, 4))
        : null,
      fuel_type: fuelType,
      color: v.eerste_kleur || null,
      vehicle_mass: v.massa_rijklaar ? parseInt(v.massa_rijklaar) : null,
      registration_date: registrationDate,
      apk_expiry_date: apkExpiry,
      // Extra fields
      vehicle_type: v.voertuigsoort || null,
      body_type: v.inrichting || null,
      num_doors: v.aantal_deuren ? parseInt(v.aantal_deuren) : null,
      catalog_price: v.catalogusprijs ? parseInt(v.catalogusprijs) : null,
      eu_vehicle_category: v.europese_voertuigcategorie || null,
      type: v.type || null,
      odometer_judgement: v.tellerstandoordeel || null,
      raw: v,
    };

    return jsonRes(result, 200, req);
  } catch (err) {
    return jsonRes({ error: (err as Error).message }, 500, req);
  }
});
