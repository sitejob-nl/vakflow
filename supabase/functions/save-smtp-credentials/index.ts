import { corsHeaders, jsonRes, optionsResponse } from "../_shared/cors.ts";
import { createAdminClient, createUserClient } from "../_shared/supabase.ts";
import { encrypt } from "../_shared/crypto.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonRes({ error: "Niet ingelogd" }, 401);
    }

    const { smtp_email, smtp_password, eboekhouden_api_token, smtp_host, smtp_port } = await req.json();

    // Verify user
    const supabaseUser = createUserClient(authHeader);
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return jsonRes({ error: "Ongeldige sessie" }, 401);
    }

    const supabaseAdmin = createAdminClient();

    // Verify caller is admin
    const { data: roleCheck } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleCheck) {
      return jsonRes({ error: "Geen toegang — alleen admins" }, 403);
    }

    // Get caller's company_id
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!callerProfile?.company_id) {
      return jsonRes({ error: "Geen bedrijf gevonden" }, 400);
    }

    // Build update payload
    const updateData: Record<string, any> = {};
    if (smtp_email !== undefined) updateData.smtp_email = smtp_email;
    if (smtp_password) updateData.smtp_password = await encrypt(smtp_password);
    if (eboekhouden_api_token !== undefined) {
      updateData.eboekhouden_api_token = eboekhouden_api_token
        ? await encrypt(eboekhouden_api_token)
        : "";
    }
    if (smtp_host !== undefined) updateData.smtp_host = smtp_host;
    if (smtp_port !== undefined) updateData.smtp_port = smtp_port;

    // Save to companies table
    const { error: updateError } = await supabaseAdmin
      .from("companies")
      .update(updateData)
      .eq("id", callerProfile.company_id);

    if (updateError) {
      return jsonRes({ error: updateError.message }, 500);
    }

    return jsonRes({ success: true });
  } catch (error: any) {
    console.error("Save SMTP credentials error:", error);
    return jsonRes({ error: "Fout bij opslaan", code: "SAVE_FAILED" }, 500);
  }
});
