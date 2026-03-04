import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    keyBytes.buffer as ArrayBuffer,
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
    ciphertext.buffer as ArrayBuffer
  );

  return new TextDecoder().decode(decrypted);
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

async function getOutlookAccessToken(refreshToken: string): Promise<string> {
  const clientId = Deno.env.get("OUTLOOK_CLIENT_ID");
  const tenantId = Deno.env.get("OUTLOOK_TENANT_ID") || "organizations";
  const clientSecret = Deno.env.get("OUTLOOK_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Outlook credentials not configured");

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      scope: "https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/Calendars.ReadWrite offline_access",
    }),
  });

  const data = await res.json();
  if (data.error) throw new Error(`Token refresh failed: ${data.error_description}`);
  return data.access_token;
}

// Map Graph API well-known folder names to our folder_name values
function mapFolderName(wellKnownName: string | null, displayName: string): string {
  if (!wellKnownName) return displayName.toLowerCase();
  switch (wellKnownName.toLowerCase()) {
    case "inbox": return "inbox";
    case "sentitems": return "sent";
    case "drafts": return "drafts";
    case "deleteditems": return "trash";
    case "junkemail": return "junk";
    case "archive": return "archive";
    default: return wellKnownName.toLowerCase();
  }
}

async function fetchOutlookEmails(
  supabaseAdmin: any,
  userCompanyId: string,
  company: any,
  customerMap: Map<string, string>
): Promise<{ fetched: number; total_unread: number; errors: string[] }> {
  console.log("Using Outlook/Graph API to fetch emails");

  const refreshToken = await decryptPassword(company.outlook_refresh_token);
  const accessToken = await getOutlookAccessToken(refreshToken);

  // Fetch mailbox folders first
  const foldersRes = await fetch(
    `https://graph.microsoft.com/v1.0/me/mailFolders?$top=50`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!foldersRes.ok) {
    console.error("Failed to fetch mail folders:", await foldersRes.text());
    // Fallback to just inbox
    return await fetchOutlookFolder(supabaseAdmin, userCompanyId, accessToken, customerMap, "inbox", "inbox");
  }

  const foldersData = await foldersRes.json();
  const folders = foldersData.value || [];
  console.log(`Found ${folders.length} mail folders`);

  // Fetch from key folders: Inbox, SentItems, Drafts
  const targetFolders = folders.filter((f: any) => 
    ["inbox", "sentitems", "drafts"].includes((f.wellKnownName || "").toLowerCase())
  );

  if (targetFolders.length === 0) {
    console.log("No matching folders found, fetching inbox only");
    return await fetchOutlookFolder(supabaseAdmin, userCompanyId, accessToken, customerMap, "inbox", "inbox");
  }

  let totalFetched = 0;
  let totalUnread = 0;
  const allErrors: string[] = [];

  for (const folder of targetFolders) {
    const folderName = mapFolderName(folder.wellKnownName, folder.displayName);
    console.log(`Fetching from folder: ${folder.displayName} (${folderName}), unread: ${folder.unreadItemCount}`);
    
    try {
      const result = await fetchOutlookFolder(
        supabaseAdmin, userCompanyId, accessToken, customerMap,
        folder.id, folderName
      );
      totalFetched += result.fetched;
      totalUnread += result.total_unread;
      allErrors.push(...result.errors);
    } catch (err) {
      console.error(`Error fetching folder ${folderName}:`, err);
      allErrors.push(String(err));
    }
  }

  return { fetched: totalFetched, total_unread: totalUnread, errors: allErrors };
}

async function fetchOutlookFolder(
  supabaseAdmin: any,
  userCompanyId: string,
  accessToken: string,
  customerMap: Map<string, string>,
  folderId: string,
  folderName: string
): Promise<{ fetched: number; total_unread: number; errors: string[] }> {
  // For inbox: fetch unread only. For sent/drafts: fetch recent messages
  const isInbox = folderName === "inbox";
  const filter = isInbox ? "&$filter=isRead eq false" : "";
  const graphUrl = `https://graph.microsoft.com/v1.0/me/mailFolders/${folderId}/messages?$top=30&$select=id,subject,from,toRecipients,receivedDateTime,body,bodyPreview,internetMessageId,isDraft${filter}&$orderby=receivedDateTime desc`;

  const graphRes = await fetch(graphUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!graphRes.ok) {
    const errText = await graphRes.text();
    console.error(`Graph API error for folder ${folderName}:`, errText);
    throw new Error(`Graph API fout voor ${folderName}: ${graphRes.status}`);
  }

  const graphData = await graphRes.json();
  const messages = graphData.value || [];
  console.log(`Found ${messages.length} messages in ${folderName}`);

  if (messages.length === 0) {
    return { fetched: 0, total_unread: 0, errors: [] };
  }

  let fetched = 0;
  const errors: string[] = [];

  for (const msg of messages) {
    try {
      const messageId = msg.internetMessageId || msg.id;
      const fromEmail = msg.from?.emailAddress?.address?.toLowerCase() || "";
      const fromName = msg.from?.emailAddress?.name || "";
      const subject = msg.subject || "(geen onderwerp)";
      const sentDate = msg.receivedDateTime || new Date().toISOString();

      const rawBody = msg.body?.content || "";
      const isHtml = msg.body?.contentType === "html";
      const htmlBody = isHtml ? rawBody.substring(0, 50000) : null;
      const plainBody = msg.bodyPreview || (isHtml ? stripHtmlTags(rawBody) : rawBody);

      // Skip duplicates
      if (messageId) {
        const { data: existing } = await supabaseAdmin
          .from("communication_logs")
          .select("id")
          .eq("message_id", messageId)
          .maybeSingle();

        if (existing) {
          continue;
        }
      }

      const customerId = customerMap.get(fromEmail) || null;
      const direction = folderName === "sent" ? "outbound" : "inbound";

      const insertData: Record<string, any> = {
        channel: "email",
        direction,
        subject,
        body: plainBody.substring(0, 10000) || null,
        html_body: htmlBody,
        sender_email: fromEmail || null,
        sender_name: fromName || null,
        sent_at: sentDate,
        status: msg.isDraft ? "draft" : "sent",
        is_automated: false,
        message_id: messageId,
        company_id: userCompanyId,
        folder_name: folderName,
      };

      if (customerId) {
        insertData.customer_id = customerId;
      }

      // For sent items, try matching recipient to customer
      if (folderName === "sent" && !customerId && msg.toRecipients?.length > 0) {
        const toEmail = msg.toRecipients[0].emailAddress?.address?.toLowerCase();
        if (toEmail) {
          const toCustomerId = customerMap.get(toEmail) || null;
          if (toCustomerId) insertData.customer_id = toCustomerId;
          // Store recipient info as sender_email for sent items display
          insertData.sender_email = toEmail;
          insertData.sender_name = msg.toRecipients[0].emailAddress?.name || "";
        }
      }

      const { error: insertError } = await supabaseAdmin
        .from("communication_logs")
        .insert(insertData);

      if (insertError) {
        if (insertError.code === "23505") {
          // duplicate
        } else {
          console.error("Insert error:", insertError);
          errors.push(insertError.message);
        }
      } else {
        fetched++;
      }

      // Mark as read in Outlook (inbox only)
      if (isInbox) {
        try {
          await fetch(`https://graph.microsoft.com/v1.0/me/messages/${msg.id}`, {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ isRead: true }),
          });
        } catch (markErr) {
          console.error("Mark read error:", markErr);
        }
      }
    } catch (msgErr) {
      console.error("Message processing error:", msgErr);
      errors.push(String(msgErr));
    }
  }

  return { fetched, total_unread: messages.length, errors };
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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("smtp_email, smtp_password, company_id")
      .eq("id", user.id)
      .single();

    const userCompanyId = profile?.company_id ?? null;

    let company: any = null;
    if (userCompanyId) {
      const { data: companyData } = await supabaseAdmin
        .from("companies")
        .select("email_provider, outlook_refresh_token, outlook_email, smtp_email, smtp_password")
        .eq("id", userCompanyId)
        .single();
      company = companyData;
    }

    // Build customer map
    const custQuery = supabaseAdmin
      .from("customers")
      .select("id, email")
      .not("email", "is", null);
    if (userCompanyId) custQuery.eq("company_id", userCompanyId);
    const { data: allCustomers } = await custQuery;

    const customerMap = new Map<string, string>();
    for (const c of allCustomers ?? []) {
      if (c.email) customerMap.set(c.email.toLowerCase(), c.id);
    }

    // ---- OUTLOOK PATH ----
    if (company?.email_provider === "outlook" && company?.outlook_refresh_token) {
      console.log("Email provider is Outlook, using Graph API");
      const result = await fetchOutlookEmails(supabaseAdmin, userCompanyId, company, customerMap);
      console.log(`Done. Fetched ${result.fetched} new Outlook emails.`);
      return new Response(
        JSON.stringify({
          fetched: result.fetched,
          total_unread: result.total_unread,
          errors: result.errors.length > 0 ? result.errors : undefined,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- IMAP/SMTP PATH ----
    console.log("Email provider is SMTP, using IMAP");

    let smtpEmail = profile?.smtp_email;
    let smtpPassword = profile?.smtp_password;

    if (company?.smtp_email && company?.smtp_password) {
      smtpEmail = company.smtp_email;
      smtpPassword = company.smtp_password;
    }

    if (!smtpEmail || !smtpPassword) {
      return new Response(
        JSON.stringify({ error: "SMTP/IMAP-gegevens niet ingesteld. Ga naar Instellingen." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let password: string;
    try {
      password = await decryptPassword(smtpPassword);
    } catch {
      password = smtpPassword;
    }

    const { ImapClient } = await import("jsr:@workingdevshero/deno-imap");

    console.log("Connecting to IMAP server...");
    const client = new ImapClient({
      host: "imap.transip.email",
      port: 993,
      tls: true,
      username: smtpEmail,
      password: password,
    });

    await client.connect();
    console.log("Connected to IMAP server");

    const inbox = await client.selectMailbox("INBOX");
    console.log(`INBOX has ${inbox.exists} messages`);

    const unreadIds = await client.search({ unseen: true } as any);
    console.log(`Found ${unreadIds.length} unread messages`);

    if (unreadIds.length === 0) {
      await client.disconnect();
      return new Response(
        JSON.stringify({ fetched: 0, message: "Geen nieuwe e-mails" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const idsToFetch = unreadIds.slice(0, 50);
    const fetchRange = idsToFetch.join(",");

    const messages = await client.fetch(fetchRange, {
      envelope: true,
      bodyStructure: true,
    } as any);

    console.log(`Fetched ${messages.length} messages`);

    let fetched = 0;
    const errors: string[] = [];

    for (const msg of messages) {
      try {
        const headerData = (msg as any).body?.["HEADER.FIELDS (MESSAGE-ID)"] || "";
        const msgIdMatch = typeof headerData === "string"
          ? headerData.match(/Message-ID:\s*<?([^>\r\n]+)>?/i)
          : null;
        const messageId = msgIdMatch ? msgIdMatch[1].trim() : null;

        if (messageId) {
          const { data: existing } = await supabaseAdmin
            .from("communication_logs")
            .select("id")
            .eq("message_id", messageId)
            .maybeSingle();

          if (existing) {
            continue;
          }
        }

        const env = msg.envelope;
        const from = env?.from?.[0];
        const fromEmail = from
          ? (from.mailbox && from.host ? `${from.mailbox}@${from.host}`.toLowerCase() : "")
          : "";
        const fromName = from?.name || "";
        const subject = env?.subject || "(geen onderwerp)";
        const sentDate = env?.date ? new Date(env.date).toISOString() : new Date().toISOString();

        const bodyContent = (msg as any).body?.["1"] || "";
        const rawBody = typeof bodyContent === "string" ? bodyContent : "";
        const isHtml = rawBody.includes("<html") || rawBody.includes("<div") || rawBody.includes("<p>");
        const htmlBody = isHtml ? rawBody.substring(0, 50000) : null;
        const plainBody = isHtml ? stripHtmlTags(rawBody) : rawBody;

        const customerId = customerMap.get(fromEmail) || null;

        const insertData: Record<string, any> = {
          channel: "email",
          direction: "inbound",
          subject,
          body: plainBody.substring(0, 10000) || null,
          html_body: htmlBody,
          sender_email: fromEmail || null,
          sender_name: fromName || null,
          sent_at: sentDate,
          status: "sent",
          is_automated: false,
          message_id: messageId,
          company_id: userCompanyId,
          folder_name: "inbox",
        };

        if (customerId) {
          insertData.customer_id = customerId;
        }

        const { error: insertError } = await supabaseAdmin
          .from("communication_logs")
          .insert(insertData);

        if (insertError) {
          if (insertError.code === "23505") {
            // duplicate
          } else {
            console.error("Insert error:", insertError);
            errors.push(insertError.message);
          }
        } else {
          fetched++;
        }

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