import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

export type DateRange = "today" | "week" | "month" | "custom";
export type DirectionFilter = "all" | "inbound" | "outbound";
export type StatusFilter = "all" | "ringing" | "answered" | "missed" | "ended" | "transferred" | "voicemail" | "ai_handled";
export type EndReasonFilter = "all" | "completed" | "busy" | "no-answer" | "failed" | "cancelled" | "abandon";

export const useCallRecords = (
  dateRange: DateRange,
  direction: DirectionFilter,
  status: StatusFilter,
  customFrom?: Date,
  customTo?: Date,
  endReason?: EndReasonFilter,
) => {
  const { companyId } = useAuth();

  return useQuery({
    queryKey: ["call-records", companyId, dateRange, direction, status, endReason, customFrom?.toISOString(), customTo?.toISOString()],
    queryFn: async () => {
      const now = new Date();
      let from: Date;
      let to: Date;

      switch (dateRange) {
        case "today":
          from = startOfDay(now);
          to = endOfDay(now);
          break;
        case "week":
          from = startOfWeek(now, { weekStartsOn: 1 });
          to = endOfWeek(now, { weekStartsOn: 1 });
          break;
        case "month":
          from = startOfMonth(now);
          to = endOfMonth(now);
          break;
        case "custom":
          from = customFrom ? startOfDay(customFrom) : startOfDay(now);
          to = customTo ? endOfDay(customTo) : endOfDay(now);
          break;
      }

      let q = supabase
        .from("call_records")
        .select("*, customers(name)")
        .gte("started_at", from.toISOString())
        .lte("started_at", to.toISOString())
        .order("started_at", { ascending: false });

      if (companyId) q = q.eq("company_id", companyId);
      if (direction !== "all") q = q.eq("direction", direction);
      if (status !== "all") q = q.eq("status", status);
      if (endReason && endReason !== "all") q = q.eq("end_reason", endReason);

      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });
};

export const useCallStats = () => {
  const { companyId } = useAuth();
  const now = new Date();

  return useQuery({
    queryKey: ["call-stats-today", companyId],
    queryFn: async () => {
      let q = supabase
        .from("call_records")
        .select("status, duration_seconds, was_transferred")
        .gte("started_at", startOfDay(now).toISOString())
        .lte("started_at", endOfDay(now).toISOString());

      if (companyId) q = q.eq("company_id", companyId);

      const { data, error } = await q;
      if (error) throw error;

      const records = data ?? [];
      const answered = records.filter((r) => r.status === "answered");
      const missed = records.filter((r) => r.status === "missed");
      const transferred = records.filter((r) => r.was_transferred === true);
      const avgDuration =
        answered.length > 0
          ? Math.round(answered.reduce((s, r) => s + (r.duration_seconds ?? 0), 0) / answered.length)
          : 0;

      return {
        total: records.length,
        answered: answered.length,
        missed: missed.length,
        transferred: transferred.length,
        avgDuration,
      };
    },
    staleTime: 30_000,
  });
};
