import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { startOfMonth, endOfMonth, format } from "date-fns";

const vehiclesTable = () => supabase.from("vehicles" as any);
const baysTable = () => supabase.from("workshop_bays" as any);

export const useAutomotiveDashboardStats = () => {
  const { companyId, industry } = useAuth();
  const isAutomotive = industry === "automotive";

  return useQuery({
    queryKey: ["automotive-dashboard", companyId],
    enabled: isAutomotive && !!companyId,
    queryFn: async () => {
      const now = new Date();
      const monthEnd = endOfMonth(now);
      const monthEndStr = format(monthEnd, "yyyy-MM-dd");
      const todayStr = format(now, "yyyy-MM-dd");

      // Parallel: vehicles with APK expiring this month, active bays, WOs in workshop (open/bezig with bay)
      const [apkRes, baysRes, activeWoRes, totalVehiclesRes] = await Promise.all([
        vehiclesTable()
          .select("id, license_plate, apk_expiry_date, customers(name)")
          .lte("apk_expiry_date", monthEndStr)
          .gte("apk_expiry_date", todayStr)
          .eq("status", "actief"),
        baysTable()
          .select("id")
          .eq("is_active", true),
        supabase
          .from("work_orders")
          .select("id, bay_id")
          .in("status", ["open", "bezig"])
          .not("bay_id", "is", null),
        vehiclesTable()
          .select("id", { count: "exact", head: true })
          .eq("status", "actief"),
      ]);

      const apkExpiring = apkRes.data ?? [];
      const totalBays = baysRes.data?.length ?? 0;
      const occupiedBayIds = new Set((activeWoRes.data ?? []).map((wo: any) => wo.bay_id).filter(Boolean));
      const occupiedBays = occupiedBayIds.size;
      const occupancyPercent = totalBays > 0 ? Math.round((occupiedBays / totalBays) * 100) : 0;

      return {
        apkExpiringThisMonth: apkExpiring as { id: string; license_plate: string; apk_expiry_date: string; customers: { name: string } | null }[],
        totalBays,
        occupiedBays,
        occupancyPercent,
        totalVehicles: totalVehiclesRes.count ?? 0,
      };
    },
    staleTime: 60_000,
  });
};
