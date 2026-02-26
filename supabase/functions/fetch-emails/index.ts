import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ImapClient, fetchUnreadMessages, markMessagesAsRead } from "jsr:@workingdevshero/deno-imap";

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
    keyBytes = base64ToBytes(keyHex);
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

function extractEmail(fromHeader: string): string {
  const match = fromHeader.match(/<([^>]+)>/);
  if (match) return match[1].toLowerCase();
  return fromHeader.trim().toLowerCase();
}

function decodeBody(bodyParts: any): string {
  if (!bodyParts) return "";
  if (typeof bodyParts === "string") return bodyParts;

  // Try to extract text from fetched message body
  if (bodyParts.text) return bodyParts.text;
  if (bodyParts.html) return bodyParts.html;

  // If it's an object with numbered keys (BODY sections)
  for (const key of Object.keys(bodyParts)) {
    const val = bodyParts[key];
    if (typeof val === "string" && val.length > 0) return val;
  }

  return JSON.stringify(bodyParts);
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

    // Auth check
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

    // Get SMTP credentials from profile
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("smtp_email, smtp_password")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.smtp_email || !profile?.smtp_password) {
      return new Response(
        JSON.stringify({ error: "SMTP/IMAP-gegevens niet ingesteld. Ga naar Instellingen." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decrypt password
    let password: string;
    try {
      password = await decryptPassword(profile.smtp_password);
    } catch {
      password = profile.smtp_password;
    }

    // Connect to IMAP
    console.log("Connecting to IMAP server...");
    const client = new ImapClient({
      host: "imap.transip.email",
      port: 993,
      tls: true,
      username: profile.smtp_email,
      password: password,
    });

    await client.connect();
    console.log("Connected to IMAP server");

    // Select INBOX
    const inbox = await client.selectMailbox("INBOX");
    console.log(`INBOX has ${inbox.exists} messages`);

    // Search for unseen messages
    const unreadIds = await client.search("UNSEEN");
    console.log(`Found ${unreadIds.length} unread messages`);

    if (unreadIds.length === 0) {
      await client.disconnect();
      return new Response(
        JSON.stringify({ fetched: 0, message: "Geen nieuwe e-mails" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Limit to 50 messages per fetch
    const idsToFetch = unreadIds.slice(0, 50);
    const fetchRange = idsToFetch.join(",");

    // Fetch message details
    const messages = await client.fetch(fetchRange, {
      envelope: true,
      bodyStructure: true,
      body: ["HEADER.FIELDS (MESSAGE-ID)", "1"],
    });

    console.log(`Fetched ${messages.length} messages`);

    // Get all customers for email matching
    const { data: allCustomers } = await supabaseAdmin
      .from("customers")
      .select("id, email")
      .not("email", "is", null);

    const customerMap = new Map<string, string>();
    for (const c of allCustomers ?? []) {
      if (c.email) customerMap.set(c.email.toLowerCase(), c.id);
    }

    let fetched = 0;
    const errors: string[] = [];

    for (const msg of messages) {
      try {
        // Extract message-id from headers
        const headerData = msg.body?.["HEADER.FIELDS (MESSAGE-ID)"] || "";
        const msgIdMatch = typeof headerData === "string"
          ? headerData.match(/Message-ID:\s*<?([^>\r\n]+)>?/i)
          : null;
        const messageId = msgIdMatch ? msgIdMatch[1].trim() : null;

        // Skip if already imported
        if (messageId) {
          const { data: existing } = await supabaseAdmin
            .from("communication_logs")
            .select("id")
            .eq("message_id", messageId)
            .maybeSingle();

          if (existing) {
            console.log(`Skipping duplicate: ${messageId}`);
            continue;
          }
        }

        // Extract envelope data
        const env = msg.envelope;
        const from = env?.from?.[0];
        const fromEmail = from
          ? (from.mailbox && from.host ? `${from.mailbox}@${from.host}`.toLowerCase() : "")
          : "";
        const subject = env?.subject || "(geen onderwerp)";
        const sentDate = env?.date ? new Date(env.date).toISOString() : new Date().toISOString();

        // Extract body
        const bodyContent = msg.body?.["1"] || "";
        const body = typeof bodyContent === "string" ? bodyContent.substring(0, 10000) : "";

        // Match customer
        const customerId = customerMap.get(fromEmail) || null;

        // Insert into communication_logs
        const insertData: Record<string, any> = {
          channel: "email",
          direction: "inbound",
          subject: fromEmail ? `${subject} [van: ${fromEmail}]` : subject,
          body: body || null,
          sent_at: sentDate,
          status: "sent",
          is_automated: false,
          message_id: messageId,
        };

        // Link to customer if matched, otherwise save without
        if (customerId) {
          insertData.customer_id = customerId;
          insertData.subject = subject;
        } else {
          console.log(`No customer match for ${fromEmail}, saving without customer link`);
        }

        const { error: insertError } = await supabaseAdmin
          .from("communication_logs")
          .insert(insertData);

        if (insertError) {
          // Likely duplicate message_id constraint
          if (insertError.code === "23505") {
            console.log(`Duplicate message_id, skipping`);
          } else {
            console.error("Insert error:", insertError);
            errors.push(insertError.message);
          }
        } else {
          fetched++;
        }

        // Mark as read on server
        try {
          await client.setFlags(String(msg.seq || msg.uid), ["\\Seen"], "add");
        } catch (flagErr) {
          console.error("Flag error:", flagErr);
        }
      } catch (msgErr) {
        console.error("Message processing error:", msgErr);
        errors.push(String(msgErr));
      }
    }

    await client.disconnect();
    console.log(`Done. Fetched ${fetched} new emails.`);

    return new Response(
      JSON.stringify({
        fetched,
        total_unread: unreadIds.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Fetch emails error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Fout bij het ophalen van e-mails" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
