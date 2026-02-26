import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Optional auth check (can be called from cron without auth or from frontend with auth)
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data, error } = await supabaseUser.auth.getClaims(authHeader.replace("Bearer ", ""));
      if (error || !data?.claims) {
        return jsonRes({ error: "Unauthorized" }, 401);
      }
    }

    // Fetch all customers with their interval
    const { data: customers, error: custErr } = await supabase
      .from("customers")
      .select("id, name, interval_months, phone, whatsapp_optin, city")
      .order("name");

    if (custErr) throw custErr;

    // Fetch latest completed work order per customer
    const { data: workOrders, error: woErr } = await supabase
      .from("work_orders")
      .select("customer_id, completed_at")
      .eq("status", "afgerond")
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false });

    if (woErr) throw woErr;

    // Build latest completion date per customer
    const latestPerCustomer: Record<string, string> = {};
    for (const wo of workOrders || []) {
      if (!latestPerCustomer[wo.customer_id]) {
        latestPerCustomer[wo.customer_id] = wo.completed_at!;
      }
    }

    const now = new Date();
    const dueCustomers: any[] = [];

    for (const c of customers || []) {
      const lastDate = latestPerCustomer[c.id];
      if (!lastDate) continue;

      const due = new Date(lastDate);
      due.setMonth(due.getMonth() + c.interval_months);

      if (due <= now) {
        dueCustomers.push({
          id: c.id,
          name: c.name,
          city: c.city,
          phone: c.phone,
          whatsapp_optin: c.whatsapp_optin,
          lastServiceDate: lastDate,
          dueDate: due.toISOString(),
          interval_months: c.interval_months,
        });
      }
    }

    console.log(`Reminder scan: ${dueCustomers.length} customers due for service`);

    // Trigger automation for each due customer
    let triggered = 0;
    let skipped = 0;

    for (const customer of dueCustomers) {
      if (!customer.phone || !customer.whatsapp_optin) {
        skipped++;
        continue;
      }

      try {
        const triggerRes = await fetch(`${supabaseUrl}/functions/v1/whatsapp-automation-trigger`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
          },
          body: JSON.stringify({
            trigger_type: "repeat_reminder",
            customer_id: customer.id,
            context: {
              reminder: {
                last_service_date: new Date(customer.lastServiceDate).toLocaleDateString("nl-NL"),
                due_date: new Date(customer.dueDate).toLocaleDateString("nl-NL"),
                interval_months: customer.interval_months,
              },
            },
          }),
        });

        const result = await triggerRes.json();
        if (result.skipped) {
          skipped++;
        } else {
          triggered++;
        }
      } catch (err) {
        console.error(`Failed to trigger for customer ${customer.name}:`, err);
        skipped++;
      }
    }

    return jsonRes({
      success: true,
      total_due: dueCustomers.length,
      triggered,
      skipped,
      customers: dueCustomers,
    });
  } catch (error) {
    console.error("Reminder scan error:", error);
    return jsonRes({ error: (error as Error).message }, 500);
  }
});
