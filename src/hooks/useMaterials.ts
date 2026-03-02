import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Material {
  id: string;
  company_id: string | null;
  name: string;
  unit: string;
  unit_price: number;
  article_number: string | null;
  category: string | null;
  created_at: string;
}

export interface WorkOrderMaterial {
  id: string;
  company_id: string | null;
  work_order_id: string;
  material_id: string | null;
  name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total: number;
  notes: string | null;
  created_at: string;
}

// Materials catalog
export const useMaterials = () => {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["materials", companyId],
    queryFn: async () => {
      let q = supabase.from("materials").select("*").order("name");
      if (companyId) q = q.eq("company_id", companyId);
      const { data, error } = await q;
      if (error) throw error;
      return data as Material[];
    },
  });
};

export const useCreateMaterial = () => {
  const qc = useQueryClient();
  const { companyId } = useAuth();
  return useMutation({
    mutationFn: async (mat: Omit<Material, "id" | "created_at" | "company_id">) => {
      const { data, error } = await supabase
        .from("materials")
        .insert({ ...mat, company_id: companyId } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["materials"] }),
  });
};

// Work order materials
export const useWorkOrderMaterials = (workOrderId?: string) => {
  return useQuery({
    queryKey: ["work_order_materials", workOrderId],
    enabled: !!workOrderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_order_materials")
        .select("*")
        .eq("work_order_id", workOrderId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as WorkOrderMaterial[];
    },
  });
};

export const useAddWorkOrderMaterial = () => {
  const qc = useQueryClient();
  const { companyId } = useAuth();
  return useMutation({
    mutationFn: async (item: {
      work_order_id: string;
      material_id?: string | null;
      name: string;
      unit: string;
      quantity: number;
      unit_price: number;
    }) => {
      const total = item.quantity * item.unit_price;
      const { data, error } = await supabase
        .from("work_order_materials")
        .insert({
          ...item,
          total,
          company_id: companyId,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["work_order_materials"] }),
  });
};

export const useDeleteWorkOrderMaterial = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("work_order_materials").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["work_order_materials"] }),
  });
};
