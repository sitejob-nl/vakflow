import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Customer = Tables<"customers"> & {
  services?: { name: string; color: string | null } | null;
};

// Fire-and-forget sync customer to e-Boekhouden
const syncCustomerToEboekhouden = async (customerId: string) => {
  try {
    const { error } = await supabase.functions.invoke("sync-invoice-eboekhouden", {
      body: { action: "sync-customer", customer_id: customerId },
    });
    if (error) console.warn("e-Boekhouden klant sync mislukt:", error.message);
  } catch (err: any) {
    console.warn("e-Boekhouden klant sync mislukt:", err.message);
  }
};

export const useCustomers = () => {
  return useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*, services:default_service_id(name, color)")
        .order("name");
      if (error) throw error;
      return data as Customer[];
    },
  });
};

export const useCustomer = (id: string | undefined) => {
  return useQuery({
    queryKey: ["customers", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*, services:default_service_id(name, color)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as Customer | null;
    },
  });
};

export const useCreateCustomer = () => {
  const qc = useQueryClient();
  const { companyId } = useAuth();
  return useMutation({
    mutationFn: async (customer: TablesInsert<"customers">) => {
      const { data, error } = await supabase.from("customers").insert({ ...customer, company_id: companyId } as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      syncCustomerToEboekhouden(data.id);
    },
  });
};

export const useUpdateCustomer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<"customers"> & { id: string }) => {
      const { data, error } = await supabase.from("customers").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      syncCustomerToEboekhouden(data.id);
    },
  });
};

export const useDeleteCustomer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
};

export const useServices = () => {
  return useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("*").order("category").order("price");
      if (error) throw error;
      return data;
    },
  });
};

export const useCreateService = () => {
  const qc = useQueryClient();
  const { companyId } = useAuth();
  return useMutation({
    mutationFn: async (service: { name: string; price: number; category?: string | null; color?: string | null; duration_minutes?: number }) => {
      const { data, error } = await supabase.from("services").insert({ ...service, company_id: companyId } as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["services"] }),
  });
};

export const useUpdateService = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; price?: number; category?: string | null; color?: string | null; duration_minutes?: number }) => {
      const { data, error } = await supabase.from("services").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["services"] }),
  });
};

export const useDeleteService = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("services").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["services"] }),
  });
};
