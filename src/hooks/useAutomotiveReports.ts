import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { differenceInHours, format, eachWeekOfInterval, startOfWeek, endOfWeek } from "date-fns";
import type { ReportFilters } from "./useReports";

export interface RevenueByType {
  type: string;
  revenue: number;
  count: number;
}

export interface LeadTimeByType {
  type: string;
  avgHours: number;
  count: number;
}

export interface BayOccupancyWeek {
  week: string;
  occupiedCount: number;
}

export interface TireStorageStats {
  totalStored: number;
  totalMounted: number;
  totalDisposed: number;
}

export const useAutomotiveReportData = (filters: ReportFilters) => {
  const { companyId, industry } = useAuth();
  const isAutomotive = industry === "automotive";
  const startISO = filters.startDate.toISOString();
  const endISO = filters.endDate.toISOString();

  // Work orders with type, invoice total, and timing
  const woWithType = useQuery({
    queryKey: ["auto_report_wo_type", companyId, startISO, endISO],
    enabled: isAutomotive && !!companyId,
    queryFn: async () => {
      let q = supabase
        .from("work_orders")
        .select("id, work_order_type, status, created_at, completed_at, total_amount, bay_id")
        .gte("created_at", startISO)
        .lte("created_at", endISO);
      if (companyId) q = q.eq("company_id", companyId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  // Tire storage stats
  const tireStats = useQuery({
    queryKey: ["auto_report_tires", companyId],
    enabled: isAutomotive && !!companyId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("tire_storage" as any)
        .select("status") as any)
        .eq("company_id", companyId);
      if (error) throw error;
      return (data ?? []) as { status: string }[];
    },
  });

  const isLoading = woWithType.isLoading || tireStats.isLoading;

  const computedData = (() => {
    if (!isAutomotive || isLoading) return null;

    const woData = woWithType.data ?? [];
    const tires = tireStats.data ?? [];

    // Revenue by work order type
    const typeRevMap = new Map<string, { revenue: number; count: number }>();
    woData
      .filter((wo) => wo.status === "afgerond" && wo.total_amount)
      .forEach((wo) => {
        const t = wo.work_order_type || "Overig";
        const entry = typeRevMap.get(t) ?? { revenue: 0, count: 0 };
        entry.revenue += wo.total_amount ?? 0;
        entry.count += 1;
        typeRevMap.set(t, entry);
      });
    const revenueByType: RevenueByType[] = Array.from(typeRevMap.entries())
      .map(([type, d]) => ({ type, ...d }))
      .sort((a, b) => b.revenue - a.revenue);

    // Lead time by type
    const typeLeadMap = new Map<string, { totalHours: number; count: number }>();
    woData
      .filter((wo) => wo.completed_at)
      .forEach((wo) => {
        const t = wo.work_order_type || "Overig";
        const hours = differenceInHours(new Date(wo.completed_at!), new Date(wo.created_at));
        const entry = typeLeadMap.get(t) ?? { totalHours: 0, count: 0 };
        entry.totalHours += hours;
        entry.count += 1;
        typeLeadMap.set(t, entry);
      });
    const leadTimeByType: LeadTimeByType[] = Array.from(typeLeadMap.entries())
      .map(([type, d]) => ({ type, avgHours: d.count > 0 ? Math.round(d.totalHours / d.count) : 0, count: d.count }))
      .sort((a, b) => b.count - a.count);

    // Bay occupancy per week (how many WOs had a bay assigned, grouped by created_at week)
    const weeks = eachWeekOfInterval({ start: new Date(startISO), end: new Date(endISO) }, { weekStartsOn: 1 });
    const bayOccupancy: BayOccupancyWeek[] = weeks.map((weekStart) => {
      const wEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const count = woData.filter((wo) => {
        if (!wo.bay_id) return false;
        const d = new Date(wo.created_at);
        return d >= weekStart && d <= wEnd;
      }).length;
      return { week: format(weekStart, "dd/MM"), occupiedCount: count };
    });

    // Tire storage stats
    const tireStorageStats: TireStorageStats = {
      totalStored: tires.filter((t) => t.status === "opgeslagen").length,
      totalMounted: tires.filter((t) => t.status === "gemonteerd").length,
      totalDisposed: tires.filter((t) => t.status === "afgevoerd").length,
    };

    return { revenueByType, leadTimeByType, bayOccupancy, tireStorageStats };
  })();

  return { data: computedData, isLoading, isAutomotive };
};
