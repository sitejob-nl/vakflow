import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type WorkOrder = Tables<"work_orders"> & {
  customers?: { name: string; address: string | null; city: string | null } | null;
  services?: { name: string; color: string | null; price: number; category: string | null } | null;
};

const WO_QUERY_KEYS = ["work_orders", "work_orders-paginated"];

export const useWorkOrders = () => {
  const { companyId } = useAuth();
  const keys = useMemo(() => WO_QUERY_KEYS, []);
  useRealtimeSubscription("work_orders", keys, companyId);
  return useQuery({
    queryKey: ["work_orders", companyId],
    queryFn: async () => {
      let q = supabase
        .from("work_orders")
        .select("*, customers(name, address, city), services(name, color, price, category)")
        .order("created_at", { ascending: false });
      if (companyId) q = q.eq("company_id", companyId);
      const { data, error } = await q;
      if (error) throw error;
      return data as WorkOrder[];
    },
  });
};

export interface PaginatedWorkOrdersParams {
  page: number;
  pageSize: number;
  statusFilter?: string | null;
}

export const usePaginatedWorkOrders = (params: PaginatedWorkOrdersParams) => {
  const { companyId } = useAuth();
  const { page, pageSize, statusFilter } = params;

  return useQuery({
    queryKey: ["work_orders-paginated", companyId, page, pageSize, statusFilter],
    queryFn: async () => {
      const from = page * pageSize;
      const to = from + pageSize - 1;

      let q = supabase
        .from("work_orders")
        .select("*, customers(name, address, city), services(name, color, price, category)", { count: "exact" })
        .order("created_at", { ascending: false });

      if (companyId) q = q.eq("company_id", companyId);
      if (statusFilter) q = q.eq("status", statusFilter);

      q = q.range(from, to);

      const { data, error, count } = await q;
      if (error) throw error;
      return { data: data as WorkOrder[], totalCount: count ?? 0 };
    },
    placeholderData: (prev) => prev,
  });
};

export const useWorkOrder = (id: string | undefined) => {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["work_orders", id, companyId],
    enabled: !!id,
    queryFn: async () => {
      let q = supabase
        .from("work_orders")
        .select("*, customers(name, address, city, contact_person, phone, email), services(name, color, price, category)")
        .eq("id", id!);
      if (companyId) q = q.eq("company_id", companyId);
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      return data as WorkOrder & { customers: { name: string; address: string | null; city: string | null; contact_person: string | null; phone: string | null; email: string | null } | null } | null;
    },
  });
};

export const useCreateWorkOrder = () => {
  const qc = useQueryClient();
  const { companyId } = useAuth();
  return useMutation({
    mutationFn: async (wo: TablesInsert<"work_orders">) => {
      const { data, error } = await supabase.from("work_orders").insert({ ...wo, company_id: companyId } as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["work_orders"] }),
  });
};

export const useUpdateWorkOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<"work_orders"> & { id: string }) => {
      const { data, error } = await supabase.from("work_orders").update(updates).eq("id", id).select("*, customers(name, email), services(name)").single();
      if (error) throw error;

      // Trigger email automation when work order is completed
      if (updates.status === "afgerond" && data.customer_id) {
        const wo = data as any;
        supabase.functions.invoke("trigger-email-automation", {
          body: {
            trigger_type: "work_order_completed",
            customer_id: data.customer_id,
            context: {
              werkbonnummer: wo.work_order_number || "",
              bedrag: wo.total_amount ? `€${Number(wo.total_amount).toFixed(2)}` : "",
              work_order_id: id,
            },
          },
        }).catch((err) => console.error("Email automation trigger failed:", err));
      }

      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["work_orders"] }),
  });
};

export const useDeleteWorkOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("work_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["work_orders"] }),
  });
};
