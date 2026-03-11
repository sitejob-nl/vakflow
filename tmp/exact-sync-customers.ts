import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Map table names to their sync edge function names
const SYNC_FUNCTION_MAP: Record<string, { functionName: string; actionField: string }> = {
  customers: { functionName: "exact-sync-customers", actionField: "customerId" },
  orders: { functionName: "exact-sync-sales-orders", actionField: "orderId" },
  quotes: { functionName: "exact-sync-quotes", actionField: "quoteId" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Fetch pending queue items (max 50 per batch)
    const { data: queueItems, error: fetchError } = await supabase
      .from("exact_sync_queue")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(50);

    if (fetchError) throw fetchError;
    if (!queueItems || queueItems.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group by division + table for batch processing
    const groups = new Map<string, typeof queueItems>();
    for (const item of queueItems) {
      const key = `${item.division_id}:${item.table_name}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }

    let processed = 0;
    let failed = 0;

    for (const [key, items] of groups) {
      const [divisionId, tableName] = key.split(":");
      const syncConfig = SYNC_FUNCTION_MAP[tableName];

      if (!syncConfig) {
        // Unknown table, mark as failed
        const ids = items.map((i) => i.id);
        await supabase
          .from("exact_sync_queue")
          .update({ status: "failed", error_message: `Unknown table: ${tableName}`, processed_at: new Date().toISOString() })
          .in("id", ids);
        failed += ids.length;
        continue;
      }

      // Mark as processing
      const ids = items.map((i) => i.id);
      await supabase
        .from("exact_sync_queue")
        .update({ status: "processing", attempts: items[0].attempts + 1 })
        .in("id", ids);

      try {
        // For individual record syncs, process each item
        for (const item of items) {
          try {
            const body: Record<string, string> = {
              action: "push",
              divisionId: item.division_id,
            };
            body[syncConfig.actionField] = item.record_id;

            const response = await fetch(`${SUPABASE_URL}/functions/v1/${syncConfig.functionName}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
              },
              body: JSON.stringify(body),
            });

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`Sync failed: ${errorText}`);
            }

            await supabase
              .from("exact_sync_queue")
              .update({ status: "completed", processed_at: new Date().toISOString() })
              .eq("id", item.id);
            processed++;
          } catch (itemError) {
            const errorMsg = itemError instanceof Error ? itemError.message : String(itemError);
            const newStatus = item.attempts >= 2 ? "failed" : "pending";
            await supabase
              .from("exact_sync_queue")
              .update({
                status: newStatus,
                error_message: errorMsg,
                processed_at: newStatus === "failed" ? new Date().toISOString() : null,
              })
              .eq("id", item.id);
            failed++;
          }
        }
      } catch (groupError) {
        const errorMsg = groupError instanceof Error ? groupError.message : String(groupError);
        await supabase
          .from("exact_sync_queue")
          .update({ status: "pending", error_message: errorMsg })
          .in("id", ids);
        failed += ids.length;
      }
    }

    // Clean up old completed items (older than 7 days)
    await supabase
      .from("exact_sync_queue")
      .delete()
      .eq("status", "completed")
      .lt("processed_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    return new Response(
      JSON.stringify({ success: true, processed, failed, total: queueItems.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Queue processing error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
