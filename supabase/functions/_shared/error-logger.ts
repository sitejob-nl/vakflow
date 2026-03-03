// _shared/error-logger.ts — Centralized edge function error logging

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Log an edge function error. Fire-and-forget — errors are logged but never thrown.
 */
export async function logEdgeFunctionError(
  supabaseAdmin: SupabaseClient,
  functionName: string,
  errorMessage: string,
  details: Record<string, unknown> = {},
  companyId?: string | null,
  severity: "error" | "warning" = "error"
): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from("edge_function_errors").insert({
      function_name: functionName,
      error_message: errorMessage.substring(0, 2000),
      error_details: details,
      company_id: companyId || null,
      severity,
    });
    if (error) console.error(`Error logger insert failed:`, error.message);
  } catch (err) {
    console.error(`Error logger exception:`, err);
  }
}
