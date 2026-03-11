import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MONEYBIRD_API_BASE = "https://moneybird.com/api/v2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Moneybird validates webhook URLs by sending a GET request expecting 200
  if (req.method === "GET") {
    return new Response("OK", { status: 200, headers: corsHeaders });
  }

  // Moneybird may also validate with a POST without JSON content-type
  if (req.method === "POST" && !req.headers.get("content-type")?.includes("application/json")) {
    return new Response("OK", { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);
    const encryptionKey = serviceKey.substring(0, 32);

    const body = await req.json();
    const { action } = body;

    // ── Admin actions require authentication ──
    const adminActions = ['register_webhook', 'list_webhooks', 'get_mandate_status', 'send_mandate_email', 'get_mandate_url'];
    if (adminActions.includes(action)) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authError } = await userClient.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── Admin action: register webhook at Moneybird ──
    if (action === "register_webhook") {
      const { data: mbTokenData } = await supabase.rpc("decrypt_setting", {
        p_key: "MONEYBIRD_API_TOKEN",
        p_passphrase: encryptionKey,
      });
      const { data: mbAdminIdData } = await supabase.rpc("decrypt_setting", {
        p_key: "MONEYBIRD_ADMINISTRATION_ID",
        p_passphrase: encryptionKey,
      });
      const mbToken = mbTokenData || Deno.env.get("MONEYBIRD_API_TOKEN");
      const mbAdminId = mbAdminIdData || Deno.env.get("MONEYBIRD_ADMINISTRATION_ID");

      if (!mbToken || !mbAdminId) {
        return new Response(
          JSON.stringify({ error: "Moneybird API keys niet geconfigureerd" }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const webhookUrl = `${supabaseUrl}/functions/v1/moneybird-webhook`;

      const res = await fetch(`${MONEYBIRD_API_BASE}/${mbAdminId}/webhooks.json`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${mbToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: webhookUrl,
          enabled_events: [
            "sales_invoice_state_changed_to_paid",
            "sales_invoice_state_changed_to_late",
            "sales_invoice_state_changed_to_open",
            "sales_invoice_state_changed_to_pending_payment",
            "sales_invoice_state_changed_to_reminded",
            "sales_invoice_state_changed_to_uncollectible",
            "payment_registered",
          ],
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Moneybird webhook registration failed [${res.status}]: ${err}`);
      }

      const webhook = await res.json();

      await supabase.rpc("upsert_encrypted_setting", {
        p_key: "MONEYBIRD_WEBHOOK_TOKEN",
        p_value: webhook.token || "",
        p_passphrase: encryptionKey,
        p_user_id: "00000000-0000-0000-0000-000000000000",
        p_description: "Moneybird Webhook verification token",
      });

      await supabase.from("activity_log").insert({
        action: "moneybird_webhook_registered",
        entity_type: "settings",
        details: { webhook_id: webhook.id, url: webhookUrl },
      });

      return new Response(
        JSON.stringify({ success: true, webhook_id: webhook.id, url: webhookUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Admin action: list webhooks ──
    if (action === "list_webhooks") {
      const { data: mbTokenData } = await supabase.rpc("decrypt_setting", {
        p_key: "MONEYBIRD_API_TOKEN",
        p_passphrase: encryptionKey,
      });
      const { data: mbAdminIdData } = await supabase.rpc("decrypt_setting", {
        p_key: "MONEYBIRD_ADMINISTRATION_ID",
        p_passphrase: encryptionKey,
      });
      const mbToken = mbTokenData || Deno.env.get("MONEYBIRD_API_TOKEN");
      const mbAdminId = mbAdminIdData || Deno.env.get("MONEYBIRD_ADMINISTRATION_ID");

      if (!mbToken || !mbAdminId) {
        return new Response(
          JSON.stringify({ error: "Moneybird API keys niet geconfigureerd" }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const res = await fetch(`${MONEYBIRD_API_BASE}/${mbAdminId}/webhooks.json`, {
        headers: { Authorization: `Bearer ${mbToken}` },
      });
      const webhooks = await res.json();

      return new Response(JSON.stringify({ webhooks }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Admin action: get mandate status for a contact ──
    if (action === "get_mandate_status") {
      const { moneybird_contact_id } = body;
      if (!moneybird_contact_id) {
        return new Response(JSON.stringify({ error: "Missing moneybird_contact_id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: mbTokenData } = await supabase.rpc("decrypt_setting", {
        p_key: "MONEYBIRD_API_TOKEN", p_passphrase: encryptionKey,
      });
      const { data: mbAdminIdData } = await supabase.rpc("decrypt_setting", {
        p_key: "MONEYBIRD_ADMINISTRATION_ID", p_passphrase: encryptionKey,
      });
      const mbToken = mbTokenData || Deno.env.get("MONEYBIRD_API_TOKEN");
      const mbAdminId = mbAdminIdData || Deno.env.get("MONEYBIRD_ADMINISTRATION_ID");

      if (!mbToken || !mbAdminId) {
        return new Response(
          JSON.stringify({ error: "Moneybird API keys niet geconfigureerd" }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const res = await fetch(
        `${MONEYBIRD_API_BASE}/${mbAdminId}/contacts/${moneybird_contact_id}/moneybird_payments_mandate.json`,
        { headers: { Authorization: `Bearer ${mbToken}` } }
      );

      if (res.status === 404) {
        return new Response(JSON.stringify({ has_mandate: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Mandate status failed [${res.status}]: ${err}`);
      }

      const mandate = await res.json();
      const maskedIban = mandate.iban ? mandate.iban.replace(/(.{4})(.*)(.{4})/, '$1****$3') : null;

      return new Response(JSON.stringify({
        has_mandate: true,
        type: mandate.type,
        bank: mandate.bank,
        iban: maskedIban,
        iban_account_name: mandate.iban_account_name,
        sepa_mandate: mandate.sepa_mandate,
        created_at: mandate.created_at,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Admin action: send mandate email to contact ──
    if (action === "send_mandate_email") {
      const { moneybird_contact_id } = body;
      if (!moneybird_contact_id) {
        return new Response(JSON.stringify({ error: "Missing moneybird_contact_id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let emailSendMode = "test";
      try {
        const { data: modeData } = await supabase.rpc("decrypt_setting", {
          p_key: "EMAIL_SEND_MODE",
          p_passphrase: encryptionKey,
        });
        if (modeData) emailSendMode = modeData;
      } catch { /* default to test */ }

      if (emailSendMode === "test") {
        console.log(`[MB-WEBHOOK] TESTMODUS: mandaat e-mail naar contact ${moneybird_contact_id} geblokkeerd`);
        return new Response(JSON.stringify({ blocked: true, reason: "Testmodus actief — mandaat e-mail wordt niet verstuurd", moneybird_contact_id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: mbTokenData } = await supabase.rpc("decrypt_setting", {
        p_key: "MONEYBIRD_API_TOKEN", p_passphrase: encryptionKey,
      });
      const { data: mbAdminIdData } = await supabase.rpc("decrypt_setting", {
        p_key: "MONEYBIRD_ADMINISTRATION_ID", p_passphrase: encryptionKey,
      });
      const mbToken = mbTokenData || Deno.env.get("MONEYBIRD_API_TOKEN");
      const mbAdminId = mbAdminIdData || Deno.env.get("MONEYBIRD_ADMINISTRATION_ID");

      if (!mbToken || !mbAdminId) {
        return new Response(
          JSON.stringify({ error: "Moneybird API keys niet geconfigureerd" }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const res = await fetch(
        `${MONEYBIRD_API_BASE}/${mbAdminId}/contacts/${moneybird_contact_id}/moneybird_payments_mandate.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${mbToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }
      );

      if (!res.ok && res.status !== 204) {
        const err = await res.text();
        throw new Error(`Mandate email failed [${res.status}]: ${err}`);
      }
      if (res.status !== 204) await res.text();

      await supabase.from("activity_log").insert({
        action: "moneybird_mandate_email_sent",
        entity_type: "member",
        entity_id: moneybird_contact_id,
        details: {},
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Admin action: get mandate URL for a contact ──
    if (action === "get_mandate_url") {
      const { wc_customer_id } = body;
      if (!wc_customer_id) {
        return new Response(JSON.stringify({ error: "Missing wc_customer_id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: mbTokenData } = await supabase.rpc("decrypt_setting", {
        p_key: "MONEYBIRD_API_TOKEN",
        p_passphrase: encryptionKey,
      });
      const { data: mbAdminIdData } = await supabase.rpc("decrypt_setting", {
        p_key: "MONEYBIRD_ADMINISTRATION_ID",
        p_passphrase: encryptionKey,
      });
      const mbToken = mbTokenData || Deno.env.get("MONEYBIRD_API_TOKEN");
      const mbAdminId = mbAdminIdData || Deno.env.get("MONEYBIRD_ADMINISTRATION_ID");

      if (!mbToken || !mbAdminId) {
        return new Response(
          JSON.stringify({ error: "Moneybird API keys niet geconfigureerd" }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: customer } = await supabase
        .from("wc_customers")
        .select("moneybird")
        .eq("id", Number(wc_customer_id))
        .maybeSingle();

      const mb = (customer?.moneybird || {}) as Record<string, string>;
      if (!mb.contact_id) {
        return new Response(
          JSON.stringify({ error: "Lid heeft nog geen Moneybird contact. Maak eerst een factuur aan." }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const res = await fetch(
        `${MONEYBIRD_API_BASE}/${mbAdminId}/contacts/${mb.contact_id}/moneybird_payments_mandate/url.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${mbToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Mandate URL failed [${res.status}]: ${err}`);
      }

      const mandate = await res.json();

      return new Response(JSON.stringify({ success: true, mandate_url: mandate.url, expires_at: mandate.expires_at }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── create_subscription moved to moneybird-invoice function ──

    // ── Incoming Moneybird webhook event ──
    const { action: eventAction, entity_type, entity_id, state, webhook_token } = body;

    if (!eventAction || !entity_id) {
      // Moneybird validation ping during webhook registration — return 200
      console.log("[MB-WEBHOOK] No action/entity_id in body, treating as validation ping");
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // Optionally verify webhook_token
    if (webhook_token) {
      const { data: storedToken } = await supabase.rpc("decrypt_setting", {
        p_key: "MONEYBIRD_WEBHOOK_TOKEN",
        p_passphrase: encryptionKey,
      });
      if (storedToken && storedToken !== webhook_token) {
        console.warn("[MB-WEBHOOK] Token mismatch, rejecting");
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    console.log(`[MB-WEBHOOK] Received: ${eventAction} for ${entity_type} ${entity_id}`);

    // Map Moneybird event to status
    let newStatus: string | null = null;
    if (eventAction.includes("_to_paid")) {
      newStatus = "paid";
    } else if (eventAction.includes("_to_late")) {
      newStatus = "late";
    } else if (eventAction.includes("_to_reminded")) {
      newStatus = "reminded";
    } else if (eventAction.includes("_to_uncollectible")) {
      newStatus = "uncollectible";
    } else if (eventAction.includes("_to_open") || eventAction.includes("_to_pending_payment")) {
      newStatus = "sent";
    } else if (eventAction === "payment_registered") {
      newStatus = "paid";
    }

    if (newStatus) {
      // Update all invoices matching this moneybird_invoice_id
      const { data: updated, error: updateErr } = await supabase
        .from("moneybird_invoices")
        .update({ status: newStatus })
        .eq("moneybird_invoice_id", String(entity_id))
        .select("id, wc_customer_id, invoice_type, signup_id");

      if (updateErr) {
        console.error("[MB-WEBHOOK] Update error:", updateErr.message);
      } else if (updated && updated.length > 0) {
        console.log(`[MB-WEBHOOK] Updated ${updated.length} invoice(s) to status: ${newStatus}`);

        await supabase.from("activity_log").insert({
          action: `moneybird_invoice_${newStatus}`,
          entity_type: "moneybird_invoice",
          entity_id: String(entity_id),
          details: {
            event: eventAction,
            new_status: newStatus,
            wc_customer_ids: updated.map((u: any) => u.wc_customer_id),
          },
        });

        // Push notificatie bij betaling
        if (newStatus === "paid") {
          try {
            // Haal factuurbedrag op
            const invoice = updated[0];
            const { data: invoiceData } = await supabase
              .from("moneybird_invoices")
              .select("amount, invoice_number")
              .eq("moneybird_invoice_id", String(entity_id))
              .maybeSingle();

            const amount = invoiceData?.amount ? `€${Number(invoiceData.amount).toFixed(2)}` : "";
            const invoiceNr = invoiceData?.invoice_number || entity_id;

            await fetch(`${supabaseUrl}/functions/v1/push-notify`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${serviceKey}`,
              },
              body: JSON.stringify({
                title: "Betaling ontvangen",
                body: `Factuur ${invoiceNr} ${amount} is betaald`,
                url: "/administratie",
                tag: "payment-received",
              }),
            });
          } catch (pushErr) {
            console.warn("[MB-WEBHOOK] Push notify failed:", pushErr);
          }
        }

        // ── PHASE 2: Activate member on payment ──
        if (newStatus === "paid") {
          for (const invoice of updated) {
            if (invoice.invoice_type !== "membership") continue;
            if (!invoice.signup_id) {
              console.log(`[MB-WEBHOOK] Paid membership invoice ${invoice.id} has no signup_id, skipping activation`);
              continue;
            }

            // Check if this is a renewal (member already exists in wc_customers)
            const { data: existingCustomer } = await supabase
              .from("wc_customers")
              .select("id")
              .eq("id", invoice.wc_customer_id)
              .maybeSingle();

            if (existingCustomer && invoice.wc_customer_id > 0) {
              // RENEWAL: member already exists — create pending approval instead of auto-activating
              console.log(`[MB-WEBHOOK] Renewal payment for existing WC customer ${invoice.wc_customer_id}, creating renewal_pending approval`);

              // Create a renewal_pending approval record for manual review
              const { error: approvalErr } = await supabase
                .from("member_approvals")
                .upsert({
                  woocommerce_customer_id: String(invoice.wc_customer_id),
                  approval_status: "renewal_pending",
                  notes: `Renewal betaling ontvangen (Moneybird factuur ${entity_id})`,
                  reviewed_at: null,
                  reviewed_by: null,
                }, { onConflict: "woocommerce_customer_id" });

              if (approvalErr) {
                console.error(`[MB-WEBHOOK] Failed to create renewal approval:`, approvalErr);
              } else {
                console.log(`[MB-WEBHOOK] renewal_pending approval created for WC customer ${invoice.wc_customer_id}`);
              }

              await supabase.from("activity_log").insert({
                action: "membership_renewal_pending_approval",
                entity_type: "member",
                entity_id: String(invoice.wc_customer_id),
                details: {
                  moneybird_invoice_id: String(entity_id),
                  signup_id: invoice.signup_id,
                  note: "Renewal paused for manual approval",
                },
              });
              continue;
            }

            // FIRST PAYMENT: full activation
            console.log(`[MB-WEBHOOK] First payment - activating member for signup ${invoice.signup_id}`);

            try {
              const wcRes = await fetch(`${supabaseUrl}/functions/v1/create-wc-member`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${serviceKey}`,
                },
                body: JSON.stringify({ signup_id: invoice.signup_id }),
              });
              const wcResult = await wcRes.json();

              if (!wcRes.ok || !wcResult.success) {
                console.error("[MB-WEBHOOK] create-wc-member failed:", wcResult);
                await supabase.from("activity_log").insert({
                  action: "wc_member_creation_failed",
                  entity_type: "signup",
                  entity_id: invoice.signup_id,
                  details: { error: wcResult.error || "Unknown error" },
                });
                continue;
              }

              const wcCustomerId = wcResult.wc_customer_id;
              console.log(`[MB-WEBHOOK] WC customer created: ${wcCustomerId}`);

              // Update the local invoice record with actual wc_customer_id
              await supabase
                .from("moneybird_invoices")
                .update({ wc_customer_id: Number(wcCustomerId) })
                .eq("id", invoice.id);

              // 2. Update member_approvals to approved
              await supabase
                .from("member_approvals")
                .upsert({
                  woocommerce_customer_id: String(wcCustomerId),
                  approval_status: "approved",
                  reviewed_at: new Date().toISOString(),
                  notes: "Automatisch geactiveerd na betaling",
                }, { onConflict: "woocommerce_customer_id" });

              // Also update the old signup-based approval record if it exists
              await supabase
                .from("member_approvals")
                .update({ approval_status: "approved", reviewed_at: new Date().toISOString() })
                .eq("woocommerce_customer_id", `signup-${invoice.signup_id}`);

              // 3. Update signup_applications status to active
              await supabase
                .from("signup_applications")
                .update({ status: "active", wc_customer_id: Number(wcCustomerId) })
                .eq("id", invoice.signup_id);

              // 4. Create MemberApproved email event (triggers welcome email)
              const now = new Date();
              const hourKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T${String(now.getHours()).padStart(2, "0")}`;
              const idempotencyKey = `MemberApproved:${wcCustomerId}:${hourKey}`;

              await supabase.from("email_events").insert({
                event_type: "MemberApproved",
                entity_type: "member",
                entity_id: String(wcCustomerId),
                wc_customer_id: Number(wcCustomerId),
                payload: { activation_source: "moneybird_payment", signup_id: invoice.signup_id },
                idempotency_key: idempotencyKey,
              });

              // 5. Trigger email rules engine
              try {
                await fetch(`${supabaseUrl}/functions/v1/email-rules-engine`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${serviceKey}`,
                  },
                  body: JSON.stringify({}),
                });
              } catch (e) {
                console.warn("[MB-WEBHOOK] Failed to trigger email-rules-engine:", e);
              }

              // 6. Log activation
              await supabase.from("activity_log").insert({
                action: "member_activated_after_payment",
                entity_type: "member",
                entity_id: String(wcCustomerId),
                details: {
                  signup_id: invoice.signup_id,
                  moneybird_invoice_id: String(entity_id),
                },
              });

              console.log(`[MB-WEBHOOK] Member activation complete for WC customer ${wcCustomerId}`);
            } catch (activationError) {
              console.error("[MB-WEBHOOK] Member activation error:", activationError);
              await supabase.from("activity_log").insert({
                action: "member_activation_error",
                entity_type: "signup",
                entity_id: invoice.signup_id,
                details: { error: activationError.message },
              });
            }
          }
        }
      } else {
        console.log(`[MB-WEBHOOK] No matching invoice found for moneybird_invoice_id: ${entity_id}`);
      }
    }

    // Always return 200 to acknowledge
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Moneybird webhook error:", error);
    return new Response(JSON.stringify({ error: "Er is een fout opgetreden bij het verwerken van de webhook." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
