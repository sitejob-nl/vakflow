import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { authenticateRequest, createAdminClient } from "../_shared/supabase.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { logUsage } from "../_shared/usage.ts";
import { logEdgeFunctionError } from "../_shared/error-logger.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const admin = createAdminClient();
  let companyId: string | undefined;

  try {
    const authCtx = await authenticateRequest(req);
    companyId = authCtx.companyId;

    // Rate limit: max 10 calls per minute per company
    await checkRateLimit(admin, companyId, "ai_intake", 10, 60);

    const { complaint } = await req.json();

    if (!complaint || typeof complaint !== "string" || complaint.trim().length < 5) {
      return new Response(JSON.stringify({ error: "Klachtomschrijving is te kort" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI niet geconfigureerd" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch company materials catalog for context
    const { data: materials } = await admin
      .from("materials")
      .select("id, name, unit, unit_price, category")
      .eq("company_id", companyId)
      .order("name")
      .limit(200);

    const { data: services } = await admin
      .from("services")
      .select("id, name, price, category")
      .eq("company_id", companyId)
      .order("name")
      .limit(100);

    // Fetch company industry
    const { data: company } = await admin
      .from("companies")
      .select("industry, subcategory")
      .eq("id", companyId)
      .single();

    const isAutomotive = company?.industry === "automotive";

    const materialsList = (materials ?? [])
      .map((m) => `- ${m.name} (${m.unit}, €${m.unit_price}) [id:${m.id}]`)
      .join("\n");

    const servicesList = (services ?? [])
      .map((s) => `- ${s.name} (€${s.price}) [id:${s.id}]`)
      .join("\n");

    const systemPrompt = `Je bent een ervaren werkplaats-intake assistent voor een ${isAutomotive ? "autobedrijf" : "technisch bedrijf"}.
Analyseer de klachtomschrijving van de klant en genereer een werkbon-voorstel.

${isAutomotive ? `Beschikbare werkorder-types: apk, kleine_beurt, grote_beurt, storing, bandenwissel, aflevering, overig` : ""}

Beschikbare diensten in dit bedrijf:
${servicesList || "(geen diensten beschikbaar)"}

Beschikbare materialen in dit bedrijf:
${materialsList || "(geen materialen beschikbaar)"}

Regels:
- Kies de meest passende dienst uit de lijst (als er een match is)
- Stel alleen materialen voor die daadwerkelijk in de catalogus staan
- Schat realistische duur in (in minuten, afgerond op 15 min)
- Geef een korte samenvatting van de werkzaamheden
- Antwoord altijd in het Nederlands`;

    // Build function parameters — work_order_type only for automotive
    const properties: Record<string, any> = {
      summary: {
        type: "string",
        description: "Korte samenvatting van wat er gedaan moet worden",
      },
      estimated_duration_minutes: {
        type: "number",
        description: "Geschatte duur in minuten (afgerond op 15)",
      },
      suggested_service_id: {
        type: "string",
        description: "ID van de meest passende dienst uit de catalogus, of null",
      },
      suggested_materials: {
        type: "array",
        description: "Lijst van benodigde materialen uit de catalogus",
        items: {
          type: "object",
          properties: {
            material_id: { type: "string", description: "ID van het materiaal" },
            name: { type: "string", description: "Naam van het materiaal" },
            quantity: { type: "number", description: "Benodigd aantal" },
            unit: { type: "string", description: "Eenheid" },
          },
          required: ["material_id", "name", "quantity", "unit"],
          additionalProperties: false,
        },
      },
      urgency: {
        type: "string",
        description: "Urgentie-niveau",
        enum: ["laag", "normaal", "hoog", "spoed"],
      },
      notes: {
        type: "string",
        description: "Extra opmerkingen of aanbevelingen voor de monteur",
      },
    };

    const required = ["summary", "estimated_duration_minutes", "suggested_materials", "urgency"];

    // Only include work_order_type for automotive companies
    if (isAutomotive) {
      properties.work_order_type = {
        type: "string",
        description: "Type werkorder",
        enum: ["apk", "kleine_beurt", "grote_beurt", "storing", "bandenwissel", "aflevering", "overig"],
      };
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Klacht van klant: "${complaint}"` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_work_order_suggestion",
              description: "Genereer een werkbon-voorstel op basis van de klachtomschrijving",
              parameters: {
                type: "object",
                properties,
                required,
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_work_order_suggestion" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Te veel verzoeken, probeer later opnieuw" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI-tegoed op, neem contact op met support" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(JSON.stringify({ error: "AI-analyse mislukt" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "Geen voorstel ontvangen van AI" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const suggestion = JSON.parse(toolCall.function.arguments);

    // Log successful usage
    await logUsage(admin, companyId, "ai_intake", { complaint_length: complaint.length });

    return new Response(JSON.stringify({ suggestion }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ai-intake error:", err);

    if (err instanceof RateLimitError) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log error to edge_function_errors
    await logEdgeFunctionError(admin, "ai-intake", (err as Error).message, {
      stack: (err as Error).stack,
    }, companyId);

    const status = (err as any).status || 500;
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Onbekende fout" }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
