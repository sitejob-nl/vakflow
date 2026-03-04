// _shared/rate-limit.ts — Per-company rate limiting via usage_events

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

/**
 * Check if a company has exceeded the rate limit for a given event type.
 * Uses the usage_events table to count recent events within the window.
 *
 * @throws RateLimitError if the limit is exceeded
 */
export async function checkRateLimit(
  supabaseAdmin: SupabaseClient,
  companyId: string,
  eventType: string,
  maxRequests: number,
  windowSeconds = 60
): Promise<void> {
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();

  const { count, error } = await supabaseAdmin
    .from("usage_events")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("event_type", eventType)
    .gte("created_at", since);

  if (error) {
    // Don't block on rate-limit check failure — log and continue
    console.error(`Rate limit check error (${eventType}):`, error.message);
    return;
  }

  if ((count ?? 0) >= maxRequests) {
    throw new RateLimitError(
      `Rate limit overschreden: maximaal ${maxRequests} verzoeken per ${windowSeconds} seconden voor ${eventType}`
    );
  }
}
