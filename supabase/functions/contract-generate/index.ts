import { corsHeaders } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createServiceClient();

    // Get all active contracts where next_due_date <= today
    const today = new Date().toISOString().split("T")[0];
    const currentMonth = new Date().getMonth() + 1; // 1-12

    const { data: contracts, error: fetchErr } = await supabase
      .from("contracts")
      .select("*")
      .eq("status", "actief")
      .lte("next_due_date", today);

    if (fetchErr) throw fetchErr;
    if (!contracts || contracts.length === 0) {
      return new Response(JSON.stringify({ generated: 0, invoiced: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let generated = 0;
    let invoiced = 0;

    for (const contract of contracts) {
      // Seasonal check: skip if current month not in seasonal_months
      if (contract.seasonal_months && Array.isArray(contract.seasonal_months) && contract.seasonal_months.length > 0) {
        if (!contract.seasonal_months.includes(currentMonth)) {
          // Still bump next_due_date so we don't re-check every day
          const nextDue = new Date(contract.next_due_date);
          nextDue.setMonth(nextDue.getMonth() + (contract.interval_months || 12));
          const newStatus = contract.end_date && nextDue > new Date(contract.end_date) ? "beeindigd" : "actief";
          await supabase.from("contracts").update({
            next_due_date: nextDue.toISOString().split("T")[0],
            status: newStatus,
          }).eq("id", contract.id);
          continue;
        }
      }

      // Create work order
      const { data: wo, error: woErr } = await supabase
        .from("work_orders")
        .insert({
          company_id: contract.company_id,
          customer_id: contract.customer_id,
          service_id: contract.service_id,
          address_id: contract.address_id,
          asset_id: contract.asset_id,
          assigned_to: contract.assigned_to,
          description: contract.description || contract.name,
          status: "gepland",
        })
        .select("id")
        .single();

      if (woErr) {
        console.error(`Failed to create WO for contract ${contract.id}:`, woErr.message);
        continue;
      }

      // Create appointment
      const scheduledAt = new Date(contract.next_due_date);
      scheduledAt.setHours(9, 0, 0, 0);

      await supabase.from("appointments").insert({
        company_id: contract.company_id,
        customer_id: contract.customer_id,
        service_id: contract.service_id,
        address_id: contract.address_id,
        assigned_to: contract.assigned_to,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: 60,
        status: "gepland",
        notes: `Contract: ${contract.name}`,
      });

      // Auto-invoice: create draft invoice if enabled
      if (contract.auto_invoice && contract.price > 0) {
        const subtotal = Number((contract.price / 1.21).toFixed(2));
        const vatAmount = Number((contract.price - subtotal).toFixed(2));

        const { error: invErr } = await supabase.from("invoices").insert({
          company_id: contract.company_id,
          customer_id: contract.customer_id,
          work_order_id: wo.id,
          status: "concept",
          items: [{ description: contract.name, qty: 1, unit_price: contract.price, total: contract.price }],
          optional_items: [],
          subtotal,
          vat_percentage: 21,
          vat_amount: vatAmount,
          total: contract.price,
          notes: `Automatisch gegenereerd vanuit contract: ${contract.name}`,
        });

        if (invErr) {
          console.error(`Failed to create invoice for contract ${contract.id}:`, invErr.message);
        } else {
          invoiced++;
        }
      }

      // Update contract: bump next_due_date and last_generated_at
      const nextDue = new Date(contract.next_due_date);
      nextDue.setMonth(nextDue.getMonth() + (contract.interval_months || 12));

      // Check if contract has ended
      const newStatus = contract.end_date && nextDue > new Date(contract.end_date) ? "beeindigd" : "actief";

      await supabase
        .from("contracts")
        .update({
          last_generated_at: today,
          next_due_date: nextDue.toISOString().split("T")[0],
          status: newStatus,
        })
        .eq("id", contract.id);

      generated++;
    }

    return new Response(JSON.stringify({ generated, invoiced }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("contract-generate error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
