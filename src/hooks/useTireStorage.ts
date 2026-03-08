import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface TireSet {
  id: string;
  company_id: string;
  vehicle_id: string;
  season: string;
  brand: string | null;
  size: string | null;
  dot_code: string | null;
  tread_depth_fl: number | null;
  tread_depth_fr: number | null;
  tread_depth_rl: number | null;
  tread_depth_rr: number | null;
  location_code: string | null;
  status: string;
  notes: string | null;
  stored_at: string;
  created_at: string;
  updated_at: string;
}

const table = () => supabase.from("tire_storage" as any);

export const useVehicleTires = (vehicleId: string | undefined) => {
  return useQuery({
    queryKey: ["tire_storage", vehicleId],
    enabled: !!vehicleId,
    queryFn: async () => {
      const { data, error } = await table()
        .select("*")
        .eq("vehicle_id", vehicleId!)
        .order("stored_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as TireSet[];
    },
  });
};

export const useCreateTireSet = () => {
  const qc = useQueryClient();
  const { companyId } = useAuth();
  return useMutation({
    mutationFn: async (tire: Partial<TireSet>) => {
      const { data, error } = await table()
        .insert({ ...tire, company_id: companyId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tire_storage"] }),
  });
};

export const useUpdateTireSet = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TireSet> & { id: string }) => {
      const { data, error } = await table()
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tire_storage"] }),
  });
};

export const useDeleteTireSet = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await table().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tire_storage"] }),
  });
};
