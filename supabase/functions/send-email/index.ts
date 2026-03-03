import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { corsHeaders, jsonRes, optionsResponse } from "../_shared/cors.ts";
import { createAdminClient, createUserClient } from "../_shared/supabase.ts";
import { decrypt, base64ToBytes } from "../_shared/crypto.ts";
import { logUsage } from "../_shared/usage.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonRes({ error: "Niet ingelogd" }, 401);
    }

    const { to, subject, body, html, attachments } = await req.json();

    // Input validation
    if (!to || typeof to !== "string" || to.length > 500) {
      return jsonRes({ error: "Ongeldig 'to' veld" }, 400);
    }
    if (!subject || typeof subject !== "string" || subject.length > 998) {
      return jsonRes({ error: "Ongeldig 'subject' veld (max 998 tekens)" }, 400);
    }
    if (!body || typeof body !== "string" || body.length > 500000) {
      return jsonRes({ error: "Ongeldig 'body' veld (max 500KB)" }, 400);
    }
    if (html && (typeof html !== "string" || html.length > 500000)) {
      return jsonRes({ error: "Ongeldig 'html' veld (max 500KB)" }, 400);
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const toAddresses = to.split(",").map((e: string) => e.trim());
    if (!toAddresses.every((e: string) => emailRegex.test(e))) {
      return jsonRes({ error: "Ongeldig e-mailadres in 'to'" }, 400);
    }
    if (attachments && Array.isArray(attachments)) {
      const totalSize = attachments.reduce((sum: number, att: any) => sum + (att.content?.length || 0), 0);
      if (totalSize > 15_000_000) {
        return jsonRes({ error: "Bijlagen te groot (max 10MB)" }, 400);
      }
    }

    const supabaseAdmin = createAdminClient();
    const supabaseUser = createUserClient(authHeader);

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return jsonRes({ error: "Ongeldige sessie" }, 401);
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
      return jsonRes({ error: "SMTP-gegevens niet ingesteld. Ga naar Instellingen om je e-mail in te stellen." }, 400);
    }

    // Decrypt the password using shared crypto
    let smtpPassword: string;
    try {
      smtpPassword = await decrypt(smtpCreds.smtp_password!);
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

    // Log usage event
    if (userProfile?.company_id) {
      await logUsage(supabaseAdmin, userProfile.company_id, "email_sent", { to, subject });
    }

    return jsonRes({ success: true });
  } catch (error: any) {
    console.error("Send email error:", error);
    return jsonRes({ error: "Fout bij het versturen van de e-mail", code: "EMAIL_SEND_FAILED" }, 500);
  }
});
