import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay, startOfMonth, endOfMonth } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

export const useTodayAppointments = () => {
  const now = new Date();
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["dashboard", "today-appointments", companyId],
    queryFn: async () => {
      let q = supabase
        .from("appointments")
        .select("*, customers(name, city), services(name, color, price)")
        .gte("scheduled_at", startOfDay(now).toISOString())
        .lt("scheduled_at", endOfDay(now).toISOString())
        .order("scheduled_at");
      if (companyId) q = q.eq("company_id", companyId);
      const { data, error } = await q;
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
  const { companyId } = useAuth();

  return useQuery({
    queryKey: ["dashboard", "stats", companyId],
    queryFn: async () => {
      let apptQ = supabase.from("appointments").select("id")
        .gte("scheduled_at", startOfDay(now).toISOString())
        .lt("scheduled_at", endOfDay(now).toISOString());
      let woQ = supabase.from("work_orders").select("id").neq("status", "afgerond");
      let invQ = supabase.from("invoices").select("total").eq("status", "betaald")
        .gte("paid_at", monthStart).lte("paid_at", monthEnd);
      let outQ = supabase.from("invoices").select("total").in("status", ["verzonden", "verlopen"]);

      if (companyId) {
        apptQ = apptQ.eq("company_id", companyId);
        woQ = woQ.eq("company_id", companyId);
        invQ = invQ.eq("company_id", companyId);
        outQ = outQ.eq("company_id", companyId);
      }

      const [appointmentsRes, openWoRes, invoicesRes, outstandingRes] = await Promise.all([
        apptQ, woQ, invQ, outQ,
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
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["dashboard", "recent-work-orders", companyId],
    queryFn: async () => {
      let q = supabase
        .from("work_orders")
        .select("id, work_order_number, status, created_at, customers(name)")
        .order("created_at", { ascending: false })
        .limit(5);
      if (companyId) q = q.eq("company_id", companyId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });
};

export const useReminders = () => {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["dashboard", "reminders", companyId],
    queryFn: async () => {
      let custQ = supabase.from("customers").select("id, name, interval_months, city").order("name");
      let woQ = supabase.from("work_orders").select("customer_id, completed_at")
        .eq("status", "afgerond").not("completed_at", "is", null)
        .order("completed_at", { ascending: false });

      if (companyId) {
        custQ = custQ.eq("company_id", companyId);
        woQ = woQ.eq("company_id", companyId);
      }

      const { data: customers, error: custErr } = await custQ;
      if (custErr) throw custErr;

      const { data: workOrders, error: woErr } = await woQ;
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
