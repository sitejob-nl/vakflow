import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface LiveCallsResult {
  activeCalls: number;
  ringingCalls: number;
  answeredCalls: number;
  latestRinging: { caller_name: string | null; from_number: string | null } | null;
}

export const useLiveCalls = (): LiveCallsResult & { isLoading: boolean } => {
  const { companyId, enabledFeatures } = useAuth();
  const queryClient = useQueryClient();
  const enabled = !!companyId && enabledFeatures.includes("voip");

  // Realtime subscription
  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel("live-calls")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "call_records", filter: `company_id=eq.${companyId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["live-calls", companyId] });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [companyId, enabled, queryClient]);

  // Fallback polling every 10s
  const { data, isLoading } = useQuery({
    queryKey: ["live-calls", companyId],
    enabled,
    refetchInterval: 10_000,
    queryFn: async () => {
      const { data: records, error } = await supabase
        .from("call_records")
        .select("status, caller_name, from_number")
        .eq("company_id", companyId!)
        .in("status", ["ringing", "answered"])
        .is("ended_at", null)
        .order("started_at", { ascending: false });

      if (error) throw error;
      const rows = records ?? [];
      const ringing = rows.filter((r) => r.status === "ringing");
      const answered = rows.filter((r) => r.status === "answered");

      return {
        activeCalls: rows.length,
        ringingCalls: ringing.length,
        answeredCalls: answered.length,
        latestRinging: ringing.length > 0
          ? { caller_name: ringing[0].caller_name, from_number: ringing[0].from_number }
          : null,
      };
    },
  });

  return {
    activeCalls: data?.activeCalls ?? 0,
    ringingCalls: data?.ringingCalls ?? 0,
    answeredCalls: data?.answeredCalls ?? 0,
    latestRinging: data?.latestRinging ?? null,
    isLoading,
  };
};
