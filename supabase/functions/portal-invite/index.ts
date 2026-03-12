import { corsHeaders } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createAdminClient();

    // Authenticate the calling user (admin)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) throw new Error("Unauthorized");

    const { customer_id, company_id, email, password } = await req.json();
    if (!customer_id || !company_id || !email || !password) {
      throw new Error("Missing required fields: customer_id, company_id, email, password");
    }

    // Create auth user for the customer
    const { data: authData, error: signupErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { is_portal_user: true },
    });
    if (signupErr) throw signupErr;

    const portalUserId = authData.user.id;

    // Create portal_users record
    const { error: portalErr } = await supabase
      .from("portal_users")
      .insert({
        id: portalUserId,
        customer_id,
        company_id,
      });
    if (portalErr) {
      // Cleanup: delete the auth user if portal record fails
      await supabase.auth.admin.deleteUser(portalUserId);
      throw portalErr;
    }

    return new Response(JSON.stringify({ success: true, portal_user_id: portalUserId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("portal-invite error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
