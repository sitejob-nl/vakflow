import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay, startOfMonth, endOfMonth } from "date-fns";

export const useTodayAppointments = () => {
  const now = new Date();
  return useQuery({
    queryKey: ["dashboard", "today-appointments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*, customers(name, city), services(name, color, price)")
        .gte("scheduled_at", startOfDay(now).toISOString())
        .lt("scheduled_at", endOfDay(now).toISOString())
        .order("scheduled_at");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });
};

export const useDashboardStats = () => {
  const now = new Date();
  const monthStart = startOfMonth(now).toISOString();
  const monthEnd = endOfMonth(now).toISOString();

  return useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: async () => {
      const [appointmentsRes, openWoRes, invoicesRes, outstandingRes] = await Promise.all([
        supabase
          .from("appointments")
          .select("id")
          .gte("scheduled_at", startOfDay(now).toISOString())
          .lt("scheduled_at", endOfDay(now).toISOString()),
        supabase
          .from("work_orders")
          .select("id")
          .neq("status", "afgerond"),
        supabase
          .from("invoices")
          .select("total")
          .eq("status", "betaald")
          .gte("paid_at", monthStart)
          .lte("paid_at", monthEnd),
        supabase
          .from("invoices")
          .select("total")
          .in("status", ["verzonden", "verlopen"]),
      ]);

      if (appointmentsRes.error) throw appointmentsRes.error;
      if (openWoRes.error) throw openWoRes.error;
      if (invoicesRes.error) throw invoicesRes.error;
      if (outstandingRes.error) throw outstandingRes.error;

      const revenue = (invoicesRes.data || []).reduce((sum, i) => sum + Number(i.total), 0);
      const outstanding = (outstandingRes.data || []).reduce((sum, i) => sum + Number(i.total), 0);

      return {
        appointmentsToday: appointmentsRes.data?.length ?? 0,
        openWorkOrders: openWoRes.data?.length ?? 0,
        revenueMonth: revenue,
        outstandingAmount: outstanding,
        outstandingCount: outstandingRes.data?.length ?? 0,
      };
    },
    staleTime: 60_000,
  });
};

export const useRecentWorkOrders = () => {
  return useQuery({
    queryKey: ["dashboard", "recent-work-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_orders")
        .select("id, work_order_number, status, created_at, customers(name)")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });
};

export const useReminders = () => {
  return useQuery({
    queryKey: ["dashboard", "reminders"],
    queryFn: async () => {
      const { data: customers, error: custErr } = await supabase
        .from("customers")
        .select("id, name, interval_months, city")
        .order("name");
      if (custErr) throw custErr;

      const { data: workOrders, error: woErr } = await supabase
        .from("work_orders")
        .select("customer_id, completed_at")
        .eq("status", "afgerond")
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false });
      if (woErr) throw woErr;

      const latestPerCustomer: Record<string, string> = {};
      for (const wo of workOrders || []) {
        if (!latestPerCustomer[wo.customer_id]) {
          latestPerCustomer[wo.customer_id] = wo.completed_at!;
        }
      }

      const now = new Date();
      const reminders = (customers || [])
        .map((c) => {
          const lastDate = latestPerCustomer[c.id];
          if (!lastDate) return null;
          const due = new Date(lastDate);
          due.setMonth(due.getMonth() + c.interval_months);
          if (due > now) return null;
          return { ...c, lastServiceDate: lastDate, dueDate: due };
        })
        .filter(Boolean);

      return reminders;
    },
    staleTime: 60_000,
  });
};
