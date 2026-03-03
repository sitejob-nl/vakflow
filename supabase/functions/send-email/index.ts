import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

async function decryptPassword(encryptedStr: string): Promise<string> {
  const keyHex = Deno.env.get("SMTP_ENCRYPTION_KEY");
  if (!keyHex) throw new Error("SMTP_ENCRYPTION_KEY not configured");

  let keyBytes: Uint8Array;
  if (keyHex.length === 64 && /^[0-9a-fA-F]+$/.test(keyHex)) {
    keyBytes = hexToBytes(keyHex);
  } else {
    try {
      keyBytes = base64ToBytes(keyHex);
      if (keyBytes.length !== 32) throw new Error("not 32 bytes");
    } catch {
      keyBytes = new Uint8Array(
        await crypto.subtle.digest("SHA-256", new TextEncoder().encode(keyHex))
      );
    }
  }

  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  const [ivB64, ctB64] = encryptedStr.split(":");
  const iv = base64ToBytes(ivB64);
  const ciphertext = base64ToBytes(ctB64);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
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

    const { to, subject, body, html, attachments } = await req.json();

    // Input validation
    if (!to || typeof to !== "string" || to.length > 500) {
      return new Response(
        JSON.stringify({ error: "Ongeldig 'to' veld" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!subject || typeof subject !== "string" || subject.length > 998) {
      return new Response(
        JSON.stringify({ error: "Ongeldig 'subject' veld (max 998 tekens)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!body || typeof body !== "string" || body.length > 500000) {
      return new Response(
        JSON.stringify({ error: "Ongeldig 'body' veld (max 500KB)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (html && (typeof html !== "string" || html.length > 500000)) {
      return new Response(
        JSON.stringify({ error: "Ongeldig 'html' veld (max 500KB)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const toAddresses = to.split(",").map((e: string) => e.trim());
    if (!toAddresses.every((e: string) => emailRegex.test(e))) {
      return new Response(
        JSON.stringify({ error: "Ongeldig e-mailadres in 'to'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // Validate attachments size
    if (attachments && Array.isArray(attachments)) {
      const totalSize = attachments.reduce((sum: number, att: any) => sum + (att.content?.length || 0), 0);
      if (totalSize > 15_000_000) {
        return new Response(
          JSON.stringify({ error: "Bijlagen te groot (max 10MB)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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

    // Try to get credentials from companies table first
    const { data: userProfile } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    // Check if company uses Outlook
    let emailProvider = "smtp";
    let smtpCreds: { smtp_email: string | null; smtp_password: string | null; smtp_host: string | null; smtp_port: number | null } | null = null;

    if (userProfile?.company_id) {
      const { data: companyData } = await supabaseAdmin
        .from("companies")
        .select("smtp_email, smtp_password, smtp_host, smtp_port, email_provider, outlook_refresh_token, outlook_email")
        .eq("id", userProfile.company_id)
        .single();

      emailProvider = (companyData as any)?.email_provider || "smtp";

      if (emailProvider === "outlook" && (companyData as any)?.outlook_refresh_token) {
        // Forward to outlook-send function
        const outlookRes = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/outlook-send`,
          {
            method: "POST",
            headers: {
              Authorization: authHeader,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ to, subject, body, html, attachments }),
          }
        );
        const outlookData = await outlookRes.json();
        return new Response(JSON.stringify(outlookData), {
          status: outlookRes.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (companyData?.smtp_email && companyData?.smtp_password) {
        smtpCreds = companyData;
      }
    }

    // Fallback to profile SMTP credentials
    if (!smtpCreds) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("smtp_email, smtp_password, smtp_host, smtp_port")
        .eq("id", user.id)
        .single();
      smtpCreds = profile;
    }

    if (!smtpCreds?.smtp_email || !smtpCreds?.smtp_password) {
      return new Response(
        JSON.stringify({ error: "SMTP-gegevens niet ingesteld. Ga naar Instellingen om je e-mail in te stellen." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decrypt the password
    let smtpPassword: string;
    try {
      smtpPassword = await decryptPassword(smtpCreds.smtp_password!);
    } catch (decryptError) {
      console.error("Decrypt error:", decryptError);
      smtpPassword = smtpCreds.smtp_password!;
    }

    const smtpHost = smtpCreds.smtp_host || "smtp.transip.email";
    const smtpPort = smtpCreds.smtp_port || 465;

    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: true,
        auth: {
          username: smtpCreds.smtp_email!,
          password: smtpPassword,
        },
      },
    });

    const mailOptions: any = {
      from: smtpCreds.smtp_email!,
      to: to,
      subject: subject,
      content: body,
      html: html || undefined,
    };

    // Add attachments if provided
    if (attachments && Array.isArray(attachments)) {
      mailOptions.attachments = attachments.map((att: any) => ({
        filename: att.filename,
        content: base64ToBytes(att.content),
        contentType: att.contentType || "application/octet-stream",
        encoding: "binary",
      }));
    }

    await client.send(mailOptions);

    await client.close();

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Send email error:", error);
    return new Response(
      JSON.stringify({ error: "Fout bij het versturen van de e-mail", code: "EMAIL_SEND_FAILED" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
