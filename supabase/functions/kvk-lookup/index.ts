import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const KVK_API_KEY = Deno.env.get("KVK_API_KEY")!;
const KVK_BASE_URL = "https://api.kvk.nl/api/v2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Niet geautoriseerd" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Niet geautoriseerd" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, kvkNummer, vestigingsnummer, query } = await req.json();

    let url: string;
    switch (action) {
      case "zoeken": {
        const params = new URLSearchParams();
        if (kvkNummer) params.set("kvkNummer", kvkNummer);
        if (query) params.set("naam", query);
        params.set("resultatenPerPagina", "10");
        url = `${KVK_BASE_URL}/zoeken?${params}`;
        break;
      }

      case "basisprofiel":
        if (!kvkNummer) {
          return new Response(
            JSON.stringify({ error: "kvkNummer is verplicht" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        url = `${KVK_BASE_URL}/basisprofielen/${kvkNummer}`;
        break;

      case "vestigingsprofiel":
        if (!vestigingsnummer) {
          return new Response(
            JSON.stringify({ error: "vestigingsnummer is verplicht" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        url = `${KVK_BASE_URL}/vestigingsprofielen/${vestigingsnummer}?geoData=true`;
        break;

      case "naamgeving":
        if (!kvkNummer) {
          return new Response(
            JSON.stringify({ error: "kvkNummer is verplicht" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        url = `${KVK_BASE_URL}/naamgevingen/${kvkNummer}`;
        break;

      default:
        return new Response(
          JSON.stringify({ error: "Ongeldige action. Gebruik: zoeken, basisprofiel, vestigingsprofiel, naamgeving" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }

    // Retry up to 3 times — Supabase edge runtime sometimes gets "Connection reset by peer"
    let kvkResponse: Response | null = null;
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        kvkResponse = await fetch(url, {
          headers: {
            apikey: KVK_API_KEY,
            Accept: "application/json",
          },
        });
        break; // success
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`KVK fetch attempt ${attempt + 1} failed: ${lastError.message}`);
        if (attempt < 2) await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }

    if (!kvkResponse) {
      console.error("KVK fetch failed after 3 attempts:", lastError?.message);
      return new Response(
        JSON.stringify({ error: "KVK API niet bereikbaar, probeer het opnieuw" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!kvkResponse.ok) {
      const errorBody = await kvkResponse.text();
      let errorMessage = "KVK API fout";

      try {
        const errorJson = JSON.parse(errorBody);
        if (errorJson.code) {
          const ipdMessages: Record<string, string> = {
            IPD0004: "Ongeldig KVK-nummer",
            IPD0005: "Geen gegevens gevonden voor dit KVK-nummer",
            IPD0006: "Ongeldig vestigingsnummer",
            IPD0007: "Geen gegevens gevonden voor dit vestigingsnummer",
            IPD5200: "Geen resultaten gevonden",
            IPD1002: "Gegevens tijdelijk niet beschikbaar, probeer later opnieuw",
            IPD1003: "Gegevens tijdelijk niet beschikbaar, probeer over 5 minuten opnieuw",
          };
          errorMessage = ipdMessages[errorJson.code] || errorJson.message || errorMessage;
        }
      } catch {
        // raw text error
      }

      return new Response(
        JSON.stringify({
          error: errorMessage,
          status: kvkResponse.status,
        }),
        {
          status: kvkResponse.status === 404 ? 404 : 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await kvkResponse.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("KVK lookup error:", error);
    return new Response(
      JSON.stringify({ error: "Interne serverfout" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
