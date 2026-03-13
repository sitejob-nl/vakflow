import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { startOfDay, endOfDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek, differenceInDays } from "date-fns";

export const useAutomotiveSalesDashboard = () => {
  const { companyId, industry, enabledFeatures } = useAuth();
  const enabled = (industry === "automotive" || enabledFeatures.includes("vehicle_sales")) && !!companyId;

  return useQuery({
    queryKey: ["automotive-sales-dashboard", companyId],
    enabled,
    queryFn: async () => {
      const now = new Date();
      const monthStart = startOfMonth(now).toISOString();
      const monthEnd = endOfMonth(now).toISOString();
      const todayStart = startOfDay(now).toISOString();
      const todayEnd = endOfDay(now).toISOString();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 }).toISOString();

      const [
        stockRes,
        onlineRes,
        soldRes,
        callsRes,
        missedCallsRes,
        leadsRes,
        portalLeadsRes,
        hexonRes,
        firstStatusRes,
      ] = await Promise.all([
        // Stock count (not sold/delivered/archived)
        supabase
          .from("trade_vehicles")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId!)
          .not("status", "in", '("verkocht","afgeleverd","gearchiveerd")'),

        // Online count via hexon_listings
        supabase
          .from("hexon_listings")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId!)
          .eq("status", "online"),

        // Sold this month
        supabase
          .from("trade_vehicles")
          .select("id, purchase_price, target_sell_price, estimated_repair_cost, created_at, sold_at")
          .eq("company_id", companyId!)
          .eq("status", "verkocht")
          .gte("sold_at", monthStart)
          .lte("sold_at", monthEnd),

        // Calls today
        supabase
          .from("call_records")
          .select("id, status")
          .eq("company_id", companyId!)
          .gte("started_at", todayStart)
          .lte("started_at", todayEnd),

        // Last 5 missed calls
        supabase
          .from("call_records")
          .select("id, started_at, from_number, customer_id, customers(name)")
          .eq("company_id", companyId!)
          .eq("status", "missed")
          .order("started_at", { ascending: false })
          .limit(5),

        // Open leads (will filter by first status below)
        supabase
          .from("leads")
          .select("id, status_id")
          .eq("company_id", companyId!),

        // Portal leads this week
        supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId!)
          .in("source", ["marktplaats", "autoscout24", "autotrack"])
          .gte("created_at", weekStart)
          .lte("created_at", weekEnd),

        // Hexon listings grouped
        supabase
          .from("hexon_listings")
          .select("site_code, status")
          .eq("company_id", companyId!),

        // First lead status (lowest sort_order)
        supabase
          .from("lead_statuses")
          .select("id")
          .eq("company_id", companyId!)
          .order("sort_order", { ascending: true })
          .limit(1),
      ]);

      // Stock
      const stockCount = stockRes.count ?? 0;
      const onlineCount = onlineRes.count ?? 0;

      // Sold this month
      const soldVehicles = soldRes.data ?? [];
      const soldCount = soldVehicles.length;

      // Average margin
      const margins = soldVehicles.map(
        (v) => (v.target_sell_price ?? 0) - (v.purchase_price ?? 0) - (v.estimated_repair_cost ?? 0)
      );
      const avgMargin = margins.length > 0 ? margins.reduce((s, m) => s + m, 0) / margins.length : 0;

      // Average lead time (days)
      const leadTimes = soldVehicles
        .filter((v) => v.created_at && v.sold_at)
        .map((v) => differenceInDays(new Date(v.sold_at!), new Date(v.created_at)));
      const avgLeadTime = leadTimes.length > 0 ? Math.round(leadTimes.reduce((s, d) => s + d, 0) / leadTimes.length) : 0;

      // Calls
      const allCalls = callsRes.data ?? [];
      const callsToday = allCalls.length;
      const missedToday = allCalls.filter((c) => c.status === "missed").length;

      // Recent missed calls
      const recentMissed = (missedCallsRes.data ?? []) as unknown as {
        id: string;
        started_at: string;
        from_number: string | null;
        customer_id: string | null;
        customers: { name: string } | null;
      }[];

      // Open leads
      const firstStatusId = firstStatusRes.data?.[0]?.id;
      const openLeads = firstStatusId
        ? (leadsRes.data ?? []).filter((l) => l.status_id === firstStatusId).length
        : 0;

      // Portal leads
      const portalLeadsCount = portalLeadsRes.count ?? 0;

      // Hexon status per portal
      const hexonData = hexonRes.data ?? [];
      const hexonByPortal: Record<string, { online: number; pending: number; error: number }> = {};
      let totalErrors = 0;
      for (const listing of hexonData) {
        const code = (listing as any).site_code as string;
        if (!hexonByPortal[code]) hexonByPortal[code] = { online: 0, pending: 0, error: 0 };
        const st = ((listing as any).status as string) || "pending";
        if (st === "online") hexonByPortal[code].online++;
        else if (st === "error") { hexonByPortal[code].error++; totalErrors++; }
        else hexonByPortal[code].pending++;
      }

      return {
        stockCount,
        onlineCount,
        soldCount,
        avgMargin,
        avgLeadTime,
        callsToday,
        missedToday,
        recentMissed,
        openLeads,
        portalLeadsCount,
        hexonByPortal,
        totalHexonErrors: totalErrors,
      };
    },
    staleTime: 60_000,
  });
};
