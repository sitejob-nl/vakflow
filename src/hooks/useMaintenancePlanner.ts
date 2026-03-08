import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface MaintenanceItem {
  id: string;
  name: string;
  asset_type: string | null;
  brand: string | null;
  next_service_due: string | null;
  last_maintenance_date: string | null;
  customer_id: string | null;
  customer?: { id: string; name: string; city: string | null } | null;
  status: "overdue" | "upcoming" | "no_date";
  days_overdue?: number;
  days_until?: number;
}

export const useMaintenancePlanner = () => {
  const { companyId } = useAuth();

  return useQuery({
    queryKey: ["maintenance-planner", companyId],
    queryFn: async () => {
      let q = supabase
        .from("assets" as any)
        .select("id, name, asset_type, brand, next_service_due, last_maintenance_date, customer_id, customer:customers(id, name, city)")
        .eq("status", "actief")
        .order("next_service_due", { ascending: true, nullsFirst: false });
      if (companyId) q = q.eq("company_id", companyId);
      const { data, error } = await q;
      if (error) throw error;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const upcoming30 = new Date(today);
      upcoming30.setDate(upcoming30.getDate() + 30);

      const items: MaintenanceItem[] = ((data as any[]) ?? []).map((a) => {
        if (!a.next_maintenance_date) {
          return { ...a, status: "no_date" as const };
        }
        const nextDate = new Date(a.next_maintenance_date);
        if (nextDate <= today) {
          const diffDays = Math.ceil((today.getTime() - nextDate.getTime()) / 86400000);
          return { ...a, status: "overdue" as const, days_overdue: diffDays };
        }
        if (nextDate <= upcoming30) {
          const diffDays = Math.ceil((nextDate.getTime() - today.getTime()) / 86400000);
          return { ...a, status: "upcoming" as const, days_until: diffDays };
        }
        return { ...a, status: "upcoming" as const, days_until: Math.ceil((nextDate.getTime() - today.getTime()) / 86400000) };
      });

      const overdue = items.filter((i) => i.status === "overdue");
      const upcoming = items.filter((i) => i.status === "upcoming");

      return { overdue, upcoming, all: items };
    },
    enabled: !!companyId,
    staleTime: 60_000,
  });
};
