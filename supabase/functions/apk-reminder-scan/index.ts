import { corsFor, jsonRes, optionsResponse } from "../_shared/cors.ts";
import { createAdminClient, createUserClient } from "../_shared/supabase.ts";
import { logEdgeFunctionError } from "../_shared/error-logger.ts";
import { logUsage } from "../_shared/usage.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);

  try {
    const supabase = createAdminClient();

    // Auth: JWT or CRON_SECRET
    const authHeader = req.headers.get("Authorization");
    const cronSecret = req.headers.get("X-Cron-Secret");
    const expectedCronSecret = Deno.env.get("CRON_SECRET");

    if (authHeader?.startsWith("Bearer ")) {
      const supabaseUser = createUserClient(authHeader);
      const { data: { user }, error } = await supabaseUser.auth.getUser();
      if (error || !user) return jsonRes({ error: "Unauthorized" }, 401, req);
    } else if (cronSecret && expectedCronSecret && cronSecret === expectedCronSecret) {
      // Valid cron
    } else {
      return jsonRes({ error: "Unauthorized" }, 401, req);
    }

    // Get all companies with APK reminder settings
    const { data: settings, error: settErr } = await supabase
      .from("apk_reminder_settings")
      .select("*")
      .eq("enabled", true);

    if (settErr) throw settErr;
    if (!settings || settings.length === 0) {
      return jsonRes({ message: "No companies with APK reminders enabled", sent: 0 }, 200, req);
    }

    let totalSent = 0;
    const errors: string[] = [];

    for (const config of settings) {
      try {
        const sent = await processCompany(supabase, config);
        totalSent += sent;
      } catch (err) {
        const msg = `Company ${config.company_id}: ${(err as Error).message}`;
        errors.push(msg);
        console.error(msg);
      }
    }

    return jsonRes({ sent: totalSent, errors }, 200, req);
  } catch (err) {
    const admin = createAdminClient();
    await logEdgeFunctionError(admin, "apk-reminder-scan", (err as Error).message, { stack: (err as Error).stack });
    return jsonRes({ error: (err as Error).message }, 500, req);
  }
});

async function processCompany(supabase: any, config: any): Promise<number> {
  const { company_id, channel, days_before, email_subject, email_body } = config;
  const today = new Date();
  let sent = 0;

  // Get all vehicles with APK expiry for this company
  const { data: vehicles, error: vErr } = await supabase
    .from("vehicles")
    .select("id, license_plate, apk_expiry_date, customer_id, customers(name, email, phone, whatsapp_optin)")
    .eq("company_id", company_id)
    .eq("status", "actief")
    .not("apk_expiry_date", "is", null)
    .not("customer_id", "is", null);

  if (vErr) throw vErr;
  if (!vehicles || vehicles.length === 0) return 0;

  // Get existing reminder logs for this company to avoid duplicates
  const { data: existingLogs } = await supabase
    .from("apk_reminder_logs")
    .select("vehicle_id, reminder_type, apk_expiry_date")
    .eq("company_id", company_id);

  const sentSet = new Set(
    (existingLogs || []).map((l: any) => `${l.vehicle_id}_${l.reminder_type}_${l.apk_expiry_date}`)
  );

  // Get company SMTP/email settings for sending
  const { data: company } = await supabase
    .from("companies")
    .select("name, smtp_email, smtp_host, smtp_port, smtp_password, email_provider, outlook_refresh_token, outlook_email")
    .eq("id", company_id)
    .single();

  for (const vehicle of vehicles) {
    if (!vehicle.apk_expiry_date || !vehicle.customers) continue;

    const expiryDate = new Date(vehicle.apk_expiry_date);
    const daysUntilExpiry = Math.floor((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // Check each reminder threshold
    for (const threshold of (days_before || [30, 14, 7])) {
      if (daysUntilExpiry > threshold || daysUntilExpiry < 0) continue;

      // Only send if within the threshold window (e.g., 30d means days 30..15, 14d means 14..8, 7d means 7..0)
      const reminderType = `${threshold}d`;
      const dedup = `${vehicle.id}_${reminderType}_${vehicle.apk_expiry_date}`;
      if (sentSet.has(dedup)) continue;

      const customer = vehicle.customers;
      const plateFormatted = formatPlate(vehicle.license_plate);
      const apkDateFormatted = formatDate(vehicle.apk_expiry_date);

      // Substitute template variables
      const subject = (email_subject || "Uw APK verloopt binnenkort")
        .replace(/\{\{klantnaam\}\}/g, customer.name || "")
        .replace(/\{\{kenteken\}\}/g, plateFormatted)
        .replace(/\{\{apk_datum\}\}/g, apkDateFormatted)
        .replace(/\{\{dagen\}\}/g, String(daysUntilExpiry));

      const body = (email_body || "")
        .replace(/\{\{klantnaam\}\}/g, customer.name || "")
        .replace(/\{\{kenteken\}\}/g, plateFormatted)
        .replace(/\{\{apk_datum\}\}/g, apkDateFormatted)
        .replace(/\{\{dagen\}\}/g, String(daysUntilExpiry));

      let sendSuccess = false;

      if (channel === "email" && customer.email) {
        try {
          // Call the existing send-email function internally
          const emailRes = await fetch(
            `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({
                to: customer.email,
                subject,
                body,
                html: `<p>${body.replace(/\n/g, "<br>")}</p>`,
              }),
            }
          );
          sendSuccess = emailRes.ok;
        } catch (e) {
          console.error(`Email send failed for ${vehicle.license_plate}:`, e);
        }
      } else if (channel === "whatsapp" && customer.phone && customer.whatsapp_optin) {
        try {
          const waRes = await fetch(
            `${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-send`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({
                to: customer.phone,
                message: body,
                company_id,
              }),
            }
          );
          sendSuccess = waRes.ok;
        } catch (e) {
          console.error(`WhatsApp send failed for ${vehicle.license_plate}:`, e);
        }
      }

      if (sendSuccess) {
        // Log the sent reminder
        await supabase.from("apk_reminder_logs").insert({
          company_id,
          vehicle_id: vehicle.id,
          customer_id: vehicle.customer_id,
          reminder_type: reminderType,
          channel,
          apk_expiry_date: vehicle.apk_expiry_date,
        });

        // Also log as communication
        await supabase.from("communication_logs").insert({
          company_id,
          customer_id: vehicle.customer_id,
          channel: channel === "whatsapp" ? "whatsapp" : "email",
          direction: "outbound",
          subject: channel === "email" ? subject : null,
          body,
          status: "sent",
          is_automated: true,
          template_name: `APK herinnering (${reminderType})`,
        });

        await logUsage(supabase, company_id, "apk_reminder_sent", {
          vehicle_id: vehicle.id,
          reminder_type: reminderType,
          channel,
        });

        sentSet.add(dedup);
        sent++;
      }

      // Only send the most urgent reminder (lowest threshold)
      break;
    }
  }

  return sent;
}

function formatPlate(plate: string): string {
  const p = plate.replace(/[\s-]/g, "").toUpperCase();
  if (p.length === 6) return `${p.slice(0, 2)}-${p.slice(2, 5)}-${p.slice(5)}`;
  return p;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
}
