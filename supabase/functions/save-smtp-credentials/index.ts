import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

async function encryptPassword(plainPassword: string): Promise<string> {
  const keyHex = Deno.env.get("SMTP_ENCRYPTION_KEY");
  if (!keyHex) throw new Error("SMTP_ENCRYPTION_KEY not configured");

  // Support both hex (64 chars) and base64 (44 chars) key formats
  let keyBytes: Uint8Array;
  if (keyHex.length === 64 && /^[0-9a-fA-F]+$/.test(keyHex)) {
    keyBytes = hexToBytes(keyHex);
  } else {
    // Try base64
    const binary = atob(keyHex);
    keyBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      keyBytes[i] = binary.charCodeAt(i);
    }
  }

  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plainPassword);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );

  // Store as: base64(iv):base64(ciphertext)
  const ivB64 = bytesToBase64(iv);
  const ctB64 = bytesToBase64(new Uint8Array(encrypted));
  return `${ivB64}:${ctB64}`;
}

serve(async (req) => {
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

    const { smtp_email, smtp_password, eboekhouden_api_token, smtp_host, smtp_port, outlook_tenant_id, outlook_client_id } = await req.json();

    // Verify user
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Ongeldige sessie" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is admin
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: roleCheck } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Geen toegang — alleen admins" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get caller's company_id
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!callerProfile?.company_id) {
      return new Response(JSON.stringify({ error: "Geen bedrijf gevonden" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build update payload
    const updateData: Record<string, any> = {};
    if (smtp_email !== undefined) {
      updateData.smtp_email = smtp_email;
    }
    if (smtp_password) {
      updateData.smtp_password = await encryptPassword(smtp_password);
    }
    if (eboekhouden_api_token !== undefined) {
      updateData.eboekhouden_api_token = eboekhouden_api_token
        ? await encryptPassword(eboekhouden_api_token)
        : "";
    }
    if (smtp_host !== undefined) {
      updateData.smtp_host = smtp_host;
    }
    if (smtp_port !== undefined) {
      updateData.smtp_port = smtp_port;
    }
    if (outlook_tenant_id !== undefined) {
      updateData.outlook_tenant_id = outlook_tenant_id;
    }
    if (outlook_client_id !== undefined) {
      updateData.outlook_client_id = outlook_client_id;
    }

    // Save to companies table
    const { error: updateError } = await supabaseAdmin
      .from("companies")
      .update(updateData)
      .eq("id", callerProfile.company_id);

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Save SMTP credentials error:", error);
    return new Response(
      JSON.stringify({ error: "Fout bij opslaan", code: "SAVE_FAILED" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
