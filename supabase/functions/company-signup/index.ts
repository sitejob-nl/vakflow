import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Industry → enabled modules mapping (mirrors src/config/industryConfig.ts)
const industryModules: Record<string, string[]> = {
  technical: [
    "dashboard", "planning", "customers", "workorders", "invoices",
    "quotes", "reports", "email", "whatsapp", "communication",
    "reminders", "assets", "marketing", "contracts",
  ],
  cleaning: [
    "dashboard", "planning", "customers", "workorders", "invoices",
    "quotes", "reports", "email", "whatsapp", "communication",
    "reminders", "assets", "marketing", "contracts", "schedule", "audits",
  ],
  automotive: [
    "dashboard", "planning", "customers", "workorders", "invoices",
    "quotes", "reports", "email", "whatsapp", "communication",
    "reminders", "vehicles", "marketing", "contracts", "trade",
  ],
  pest: [
    "dashboard", "planning", "customers", "workorders", "invoices",
    "quotes", "reports", "email", "whatsapp", "communication",
    "reminders", "assets", "marketing", "contracts",
  ],
  landscaping: [
    "dashboard", "planning", "customers", "workorders", "invoices",
    "quotes", "reports", "email", "whatsapp", "communication",
    "reminders", "assets", "marketing", "contracts",
  ],
};

const allModules = [
  "dashboard", "planning", "customers", "workorders", "invoices",
  "quotes", "reports", "email", "whatsapp", "communication",
  "reminders", "assets", "marketing", "contracts", "schedule",
  "audits", "vehicles", "trade",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password, full_name, company_name, kvk_number, industry, subcategory } = await req.json();

    if (!email || !password || !company_name || !full_name) {
      return new Response(
        JSON.stringify({ error: "Email, wachtwoord, naam en bedrijfsnaam zijn verplicht" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Wachtwoord moet minimaal 6 tekens zijn" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Generate slug from company name
    const baseSlug = company_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Check if slug exists, append number if needed
    let slug = baseSlug;
    let attempt = 0;
    while (true) {
      const { data: existing } = await adminClient
        .from("companies")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!existing) break;
      attempt++;
      slug = `${baseSlug}-${attempt}`;
    }

    // Determine enabled features based on industry
    const safeIndustry = industry && industryModules[industry] ? industry : "technical";
    const enabledFeatures = industryModules[safeIndustry] ?? allModules;

    // 1. Create the company with trial
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);

    const { data: company, error: companyError } = await adminClient
      .from("companies")
      .insert({
        name: company_name,
        slug,
        kvk_number: kvk_number || null,
        industry: safeIndustry,
        subcategory: subcategory || "general",
        enabled_features: enabledFeatures,
        subscription_status: "trial",
        subscription_plan: "starter",
        trial_ends_at: trialEnd.toISOString(),
      })
      .select("id")
      .single();

    if (companyError) {
      console.error("Company creation failed:", companyError);
      return new Response(
        JSON.stringify({ error: "Registratie mislukt. Probeer het opnieuw." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Create the user
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (authError) {
      console.error("Auth user creation failed:", authError);
      await adminClient.from("companies").delete().eq("id", company.id);
      return new Response(
        JSON.stringify({ error: "Account aanmaken mislukt. Controleer je gegevens en probeer het opnieuw." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = authData.user.id;

    // 3. Update profile with company_id
    await adminClient
      .from("profiles")
      .update({ company_id: company.id })
      .eq("id", userId);

    // 4. Assign admin role
    await adminClient.from("user_roles").insert({
      user_id: userId,
      company_id: company.id,
      role: "admin",
    });

    return new Response(
      JSON.stringify({ success: true, company_id: company.id, user_id: userId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Company signup error:", err);
    return new Response(
      JSON.stringify({ error: "Er is een fout opgetreden" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
