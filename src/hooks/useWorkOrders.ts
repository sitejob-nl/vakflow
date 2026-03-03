import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type WorkOrder = Tables<"work_orders"> & {
  customers?: { name: string; address: string | null; city: string | null } | null;
  services?: { name: string; color: string | null; price: number; category: string | null } | null;
};

export const useWorkOrders = () => {
  const { companyId } = useAuth();
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
      const { data, error } = await supabase.from("work_orders").update(updates).eq("id", id).select().single();
      if (error) throw error;
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
