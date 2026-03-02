import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { startOfMonth, endOfMonth, subMonths, differenceInHours, format } from "date-fns";

export interface ReportFilters {
  startDate: Date;
  endDate: Date;
}

export interface RevenueByMonth {
  month: string;
  revenue: number;
  count: number;
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface MonteurProductivity {
  user_id: string;
  full_name: string;
  work_orders_count: number;
  total_minutes: number;
  avg_minutes_per_wo: number;
}

export const useReportData = (filters: ReportFilters) => {
  const { companyId } = useAuth();
  const startISO = filters.startDate.toISOString();
  const endISO = filters.endDate.toISOString();

  // Revenue data (invoices)
  const invoices = useQuery({
    queryKey: ["report_invoices", companyId, startISO, endISO],
    queryFn: async () => {
      let q = supabase
        .from("invoices")
        .select("total, status, created_at, issued_at")
        .gte("created_at", startISO)
        .lte("created_at", endISO);
      if (companyId) q = q.eq("company_id", companyId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  // Work orders with statuses and timing
  const workOrders = useQuery({
    queryKey: ["report_work_orders", companyId, startISO, endISO],
    queryFn: async () => {
      let q = supabase
        .from("work_orders")
        .select("id, status, created_at, completed_at, appointment_id")
        .gte("created_at", startISO)
        .lte("created_at", endISO);
      if (companyId) q = q.eq("company_id", companyId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  // Time entries for productivity
  const timeEntries = useQuery({
    queryKey: ["report_time_entries", companyId, startISO, endISO],
    queryFn: async () => {
      let q = supabase
        .from("time_entries")
        .select("user_id, duration_minutes, work_order_id, is_travel")
        .gte("started_at", startISO)
        .lte("started_at", endISO)
        .not("stopped_at", "is", null);
      if (companyId) q = q.eq("company_id", companyId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  // Profiles for monteur names
  const profiles = useQuery({
    queryKey: ["report_profiles", companyId],
    queryFn: async () => {
      let q = supabase.from("profiles").select("id, full_name");
      if (companyId) q = q.eq("company_id", companyId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  // Material costs
  const materialCosts = useQuery({
    queryKey: ["report_material_costs", companyId, startISO, endISO],
    queryFn: async () => {
      let q = supabase
        .from("work_order_materials")
        .select("total, created_at")
        .gte("created_at", startISO)
        .lte("created_at", endISO);
      if (companyId) q = q.eq("company_id", companyId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const isLoading = invoices.isLoading || workOrders.isLoading || timeEntries.isLoading || profiles.isLoading || materialCosts.isLoading;

  // Computed KPIs
  const computedData = (() => {
    if (isLoading) return null;

    const invData = invoices.data ?? [];
    const woData = workOrders.data ?? [];
    const teData = timeEntries.data ?? [];
    const profData = profiles.data ?? [];
    const matData = materialCosts.data ?? [];

    // Total revenue
    const totalRevenue = invData
      .filter((i) => i.status !== "concept")
      .reduce((sum, i) => sum + (i.total ?? 0), 0);

    const paidRevenue = invData
      .filter((i) => i.status === "betaald")
      .reduce((sum, i) => sum + (i.total ?? 0), 0);

    // Revenue by month
    const revenueByMonth: RevenueByMonth[] = [];
    const monthMap = new Map<string, { revenue: number; count: number }>();
    invData
      .filter((i) => i.status !== "concept")
      .forEach((inv) => {
        const d = inv.issued_at || inv.created_at;
        const key = format(new Date(d), "yyyy-MM");
        const entry = monthMap.get(key) ?? { revenue: 0, count: 0 };
        entry.revenue += inv.total ?? 0;
        entry.count += 1;
        monthMap.set(key, entry);
      });
    Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([month, data]) => revenueByMonth.push({ month, ...data }));

    // Work order status counts
    const statusCounts: StatusCount[] = [];
    const statusMap = new Map<string, number>();
    woData.forEach((wo) => {
      statusMap.set(wo.status, (statusMap.get(wo.status) ?? 0) + 1);
    });
    statusMap.forEach((count, status) => statusCounts.push({ status, count }));

    // Average lead time (created -> completed) in hours
    const completedWOs = woData.filter((wo) => wo.completed_at);
    const avgLeadTimeHours =
      completedWOs.length > 0
        ? completedWOs.reduce((sum, wo) => {
            return sum + differenceInHours(new Date(wo.completed_at!), new Date(wo.created_at));
          }, 0) / completedWOs.length
        : 0;

    // Productivity per monteur
    const profMap = new Map(profData.map((p) => [p.id, p.full_name ?? "Onbekend"]));
    const userTimeMap = new Map<string, { totalMin: number; woIds: Set<string> }>();
    teData.forEach((te) => {
      const entry = userTimeMap.get(te.user_id) ?? { totalMin: 0, woIds: new Set() };
      entry.totalMin += te.duration_minutes ?? 0;
      if (te.work_order_id) entry.woIds.add(te.work_order_id);
      userTimeMap.set(te.user_id, entry);
    });
    const productivity: MonteurProductivity[] = Array.from(userTimeMap.entries()).map(
      ([userId, data]) => ({
        user_id: userId,
        full_name: profMap.get(userId) ?? "Onbekend",
        work_orders_count: data.woIds.size,
        total_minutes: data.totalMin,
        avg_minutes_per_wo: data.woIds.size > 0 ? Math.round(data.totalMin / data.woIds.size) : 0,
      })
    );

    // Total material costs
    const totalMaterialCost = matData.reduce((sum, m) => sum + (m.total ?? 0), 0);

    return {
      totalRevenue,
      paidRevenue,
      revenueByMonth,
      statusCounts,
      totalWorkOrders: woData.length,
      completedWorkOrders: completedWOs.length,
      avgLeadTimeHours,
      productivity,
      totalMaterialCost,
    };
  })();

  return { data: computedData, isLoading };
};
