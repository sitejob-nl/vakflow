import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Niet ingelogd" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: "Ongeldige sessie" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get caller's company_id
    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("company_id")
      .eq("id", caller.id)
      .single();

    const callerCompanyId = callerProfile?.company_id;
    if (!callerCompanyId) {
      return new Response(JSON.stringify({ error: "Geen bedrijf gevonden voor je account" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is admin of their company
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("company_id", callerCompanyId)
      .in("role", ["admin", "super_admin"])
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Geen toegang — alleen admins" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle delete action
    if (body.action === "delete") {
      const { user_id } = body;
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id is verplicht" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (user_id === caller.id) {
        return new Response(JSON.stringify({ error: "Je kunt je eigen account niet verwijderen" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Only allow deleting users from the same company
      const { data: targetProfile } = await adminClient
        .from("profiles")
        .select("company_id")
        .eq("id", user_id)
        .single();

      if (targetProfile?.company_id !== callerCompanyId) {
        return new Response(JSON.stringify({ error: "Gebruiker behoort niet tot je bedrijf" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await adminClient.from("user_roles").delete().eq("user_id", user_id).eq("company_id", callerCompanyId);
      await adminClient.from("profiles").delete().eq("id", user_id);
      const { error } = await adminClient.auth.admin.deleteUser(user_id);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle invite action (default)
    const { email, full_name, redirect_url, role } = body;

    if (!email) {
      return new Response(JSON.stringify({ error: "E-mailadres is verplicht" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: redirect_url || supabaseUrl,
      data: { full_name: full_name || undefined, role: role || "monteur", company_id: callerCompanyId },
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Assign role and company to the new user
    if (data.user) {
      const assignRole = role || "monteur";
      
      // Update profile with company_id
      await adminClient
        .from("profiles")
        .update({ company_id: callerCompanyId })
        .eq("id", data.user.id);

      await adminClient.from("user_roles").upsert(
        { user_id: data.user.id, company_id: callerCompanyId, role: assignRole },
        { onConflict: "user_id,company_id,role" }
      );
    }

    return new Response(JSON.stringify({ success: true, user: data.user }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Invite user error:", err);
    return new Response(JSON.stringify({ error: "Er is een fout opgetreden", code: "INVITE_ERROR" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
