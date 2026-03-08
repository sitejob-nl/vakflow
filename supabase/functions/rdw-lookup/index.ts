import { corsFor, jsonRes, optionsResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);

  try {
    const { plate } = await req.json();
    if (!plate) return jsonRes({ error: "plate is required" }, 400, req);

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

    // --- Parallel fetches: fuel, inspections, defects, defect descriptions, recalls ---
    const [fuelRes, inspRes, defectsRes, defectRefsRes, recallsRes] = await Promise.allSettled([
      fetch(`https://opendata.rdw.nl/resource/8ys7-d773.json?kenteken=${normalized}`).then(r => r.ok ? r.json() : []),
      fetch(`https://opendata.rdw.nl/resource/vkij-7mwc.json?kenteken=${normalized}&$order=vervaldatum_keuring_dt DESC&$limit=20`).then(r => r.ok ? r.json() : []),
      fetch(`https://opendata.rdw.nl/resource/a34c-vvps.json?kenteken=${normalized}&$order=meld_datum_door_keuringsinstantie_dt DESC&$limit=50`).then(r => r.ok ? r.json() : []),
      fetch(`https://opendata.rdw.nl/resource/hx2c-gt7k.json?$limit=2000`).then(r => r.ok ? r.json() : []),
      fetch(`https://opendata.rdw.nl/resource/t49b-isb7.json?kenteken=${normalized}`).then(r => r.ok ? r.json() : []),
    ]);

    // Fuel
    let fuelType: string | null = null;
    if (fuelRes.status === "fulfilled" && fuelRes.value?.length > 0) {
      fuelType = fuelRes.value[0].brandstof_omschrijving || null;
    }

    // Inspections (APK history)
    let inspections: { expiry_date: string }[] = [];
    if (inspRes.status === "fulfilled" && Array.isArray(inspRes.value)) {
      inspections = inspRes.value.map((i: any) => {
        let expiryDate: string | null = null;
        if (i.vervaldatum_keuring_dt) {
          expiryDate = String(i.vervaldatum_keuring_dt).slice(0, 10);
        } else if (i.vervaldatum_keuring) {
          const raw = String(i.vervaldatum_keuring);
          if (raw.length === 8) expiryDate = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
        }
        return { expiry_date: expiryDate || "" };
      }).filter((i: any) => i.expiry_date);
    }

    // Defect reference lookup map
    const defectDescMap = new Map<string, string>();
    if (defectRefsRes.status === "fulfilled" && Array.isArray(defectRefsRes.value)) {
      for (const ref of defectRefsRes.value) {
        if (ref.gebrek_identificatie && ref.gebrek_omschrijving) {
          defectDescMap.set(ref.gebrek_identificatie, ref.gebrek_omschrijving);
        }
      }
    }

    // Defects (geconstateerde gebreken)
    let defects: { date: string; defect_id: string; description: string; count: number }[] = [];
    if (defectsRes.status === "fulfilled" && Array.isArray(defectsRes.value)) {
      defects = defectsRes.value.map((d: any) => {
        let date: string | null = null;
        if (d.meld_datum_door_keuringsinstantie_dt) {
          date = String(d.meld_datum_door_keuringsinstantie_dt).slice(0, 10);
        } else if (d.meld_datum_door_keuringsinstantie) {
          const raw = String(d.meld_datum_door_keuringsinstantie);
          if (raw.length === 8) date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
        }
        const defectId = d.gebrek_identificatie || "";
        return {
          date: date || "",
          defect_id: defectId,
          description: defectDescMap.get(defectId) || defectId,
          count: d.aantal_gebreken_geconstateerd ? parseInt(d.aantal_gebreken_geconstateerd) : 1,
        };
      }).filter((d: any) => d.date);
    }

    // Recalls (terugroepacties)
    let recalls: { status: string; ref_code: string }[] = [];
    let hasOpenRecall = false;
    if (recallsRes.status === "fulfilled" && Array.isArray(recallsRes.value)) {
      recalls = recallsRes.value.map((r: any) => ({
        status: r.code_status || r.status || "onbekend",
        ref_code: r.referentiecode_rdw || r.referentie_code_rdw || "",
      }));
      hasOpenRecall = recalls.some((r) => r.status === "O" || r.status?.toLowerCase().includes("open"));
    }

    // Parse APK expiry
    let apkExpiry: string | null = null;
    if (v.vervaldatum_apk_dt) {
      apkExpiry = v.vervaldatum_apk_dt.slice(0, 10);
    } else if (v.vervaldatum_apk) {
      const raw = String(v.vervaldatum_apk);
      if (raw.length === 8) apkExpiry = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    }

    // Parse first registration date
    let registrationDate: string | null = null;
    if (v.datum_eerste_toelating_dt) {
      registrationDate = v.datum_eerste_toelating_dt.slice(0, 10);
    } else if (v.datum_eerste_toelating) {
      const raw = String(v.datum_eerste_toelating);
      if (raw.length === 8) registrationDate = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    }

    const result = {
      found: true,
      plate: normalized,
      brand: v.merk || null,
      model: v.handelsbenaming || null,
      build_year: v.datum_eerste_toelating ? parseInt(String(v.datum_eerste_toelating).slice(0, 4)) : null,
      fuel_type: fuelType,
      color: v.eerste_kleur || null,
      vehicle_mass: v.massa_rijklaar ? parseInt(v.massa_rijklaar) : null,
      registration_date: registrationDate,
      apk_expiry_date: apkExpiry,
      vehicle_type: v.voertuigsoort || null,
      body_type: v.inrichting || null,
      num_doors: v.aantal_deuren ? parseInt(v.aantal_deuren) : null,
      catalog_price: v.catalogusprijs ? parseInt(v.catalogusprijs) : null,
      eu_vehicle_category: v.europese_voertuigcategorie || null,
      type: v.type || null,
      odometer_judgement: v.tellerstandoordeel || null,
      // New: inspection history, defects, recalls
      inspections,
      defects,
      recalls,
      has_open_recall: hasOpenRecall,
      raw: v,
    };

    return jsonRes(result, 200, req);
  } catch (err) {
    return jsonRes({ error: (err as Error).message }, 500, req);
  }
});
