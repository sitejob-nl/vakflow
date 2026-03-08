import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface CleaningDashboardStats {
  activeObjects: number;
  overdueObjects: number;
  todayWorkOrders: number;
  vehiclesWashedThisMonth: number;
  avgQualityScore: number | null;
  urgentObjects: Array<{
    id: string;
    name: string;
    object_type: string;
    next_service_due: string;
    customer_name: string | null;
  }>;
}

export const useCleaningDashboardStats = () => {
  const { companyId } = useAuth();

  return useQuery({
    queryKey: ["cleaning_dashboard", companyId],
    queryFn: async (): Promise<CleaningDashboardStats> => {
      const today = new Date().toISOString().split("T")[0];
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];

      // Active objects count
      const { count: activeObjects } = await supabase
        .from("assets" as any)
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId!)
        .eq("status", "actief");

      // Overdue objects
      const { data: overdueData } = await supabase
        .from("assets" as any)
        .select("id, name, object_type, next_service_due, customer:customers(name)")
        .eq("company_id", companyId!)
        .eq("status", "actief")
        .not("next_service_due", "is", null)
        .lte("next_service_due", today)
        .order("next_service_due");

      // Today work orders
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      const { count: todayWorkOrders } = await supabase
        .from("work_orders" as any)
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId!)
        .gte("created_at", todayStart.toISOString())
        .lte("created_at", todayEnd.toISOString());

      // Vehicles washed this month (sum vehicles_washed_total)
      const { data: washedData } = await supabase
        .from("work_orders" as any)
        .select("vehicles_washed_total")
        .eq("company_id", companyId!)
        .eq("status", "afgerond")
        .gte("completed_at", monthStart)
        .not("vehicles_washed_total", "is", null);

      const vehiclesWashedThisMonth = (washedData || []).reduce(
        (sum: number, wo: any) => sum + (wo.vehicles_washed_total || 0), 0
      );

      // Top 5 urgent objects for widget
      const { data: urgentData } = await supabase
        .from("assets" as any)
        .select("id, name, object_type, next_service_due, customer:customers(name)")
        .eq("company_id", companyId!)
        .eq("status", "actief")
        .not("next_service_due", "is", null)
        .order("next_service_due")
        .limit(5);

      return {
        activeObjects: activeObjects || 0,
        overdueObjects: (overdueData || []).length,
        todayWorkOrders: todayWorkOrders || 0,
        vehiclesWashedThisMonth,
        urgentObjects: (urgentData || []).map((o: any) => ({
          id: o.id,
          name: o.name,
          object_type: o.object_type,
          next_service_due: o.next_service_due,
          customer_name: o.customer?.name || null,
        })),
      };
    },
    enabled: !!companyId,
  });
};
