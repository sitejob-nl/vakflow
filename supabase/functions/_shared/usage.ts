// _shared/usage.ts — Log billable usage events

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Log a usage event for billing/tracking. Fire-and-forget — errors are logged but never thrown.
 */
export async function logUsage(
  supabaseAdmin: SupabaseClient,
  companyId: string,
  eventType: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from("usage_events").insert({
      company_id: companyId,
      event_type: eventType,
      metadata,
    });
    if (error) console.error(`Usage log error (${eventType}):`, error.message);
  } catch (err) {
    console.error(`Usage log exception (${eventType}):`, err);
  }
}
