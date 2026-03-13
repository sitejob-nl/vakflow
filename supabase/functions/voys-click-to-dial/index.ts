import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, corsFor, jsonRes, optionsResponse } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return optionsResponse(req);
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonRes({ error: "Niet geautoriseerd" }, 401, req);
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const supabaseUser = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return jsonRes({ error: "Niet geautoriseerd" }, 401, req);
    }

    // Get user's company
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!profile?.company_id) {
      return jsonRes({ error: "Geen bedrijf gevonden" }, 400, req);
    }

    // Get Voys config for this company
    const { data: voysConfig } = await supabaseAdmin
      .from("voys_config")
      .select("*")
      .eq("company_id", profile.company_id)
      .eq("status", "active")
      .single();

    if (!voysConfig) {
      return jsonRes({ error: "Voys niet geconfigureerd" }, 400, req);
    }

    if (!voysConfig.click_to_dial_enabled) {
      return jsonRes({ error: "Click-to-dial is niet ingeschakeld" }, 400, req);
    }

    const { phone_number, customer_id } = await req.json();

    if (!phone_number) {
      return jsonRes({ error: "Telefoonnummer is verplicht" }, 400, req);
    }

    // Get user's internal number from voys_user_mappings or profile
    const { data: userMapping } = await supabaseAdmin
      .from("voys_user_mappings")
      .select("internal_number")
      .eq("company_id", profile.company_id)
      .eq("user_id", user.id)
      .single();

    const callerNumber = userMapping?.internal_number || voysConfig.default_caller_id;

    if (!callerNumber) {
      return jsonRes({ error: "Geen intern nummer geconfigureerd. Vraag je beheerder om je nummer in te stellen." }, 400, req);
    }

    // Call VoIPGRID API to initiate click-to-dial
    const voipgridUrl = `https://partner.voipgrid.nl/api/clicktodial/`;
    const voipgridAuth = btoa(`${voysConfig.api_username}:${voysConfig.api_password}`);

    const response = await fetch(voipgridUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${voipgridAuth}`,
      },
      body: JSON.stringify({
        b_number: phone_number.replace(/[\s\-\(\)]/g, ""),
        a_number: callerNumber,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("VoIPGRID click-to-dial error:", response.status, errorText);
      return jsonRes({ error: "Gesprek starten mislukt via VoIPGRID" }, 502, req);
    }

    const result = await response.json();

    // Log the outbound call
    await supabaseAdmin.from("call_records").insert({
      company_id: profile.company_id,
      direction: "outbound",
      from_number: callerNumber,
      to_number: phone_number,
      status: "ringing",
      customer_id: customer_id || null,
      handled_by: user.id,
      voys_call_id: result.callid || null,
      metadata: { source: "click-to-dial", voipgrid_response: result },
    });

    return jsonRes({
      success: true,
      message: "Gesprek wordt opgezet. Je telefoon gaat zo over.",
      callid: result.callid,
    }, 200, req);

  } catch (err) {
    console.error("Click-to-dial error:", err);
    return jsonRes({ error: "Interne fout" }, 500, req);
  }
});
