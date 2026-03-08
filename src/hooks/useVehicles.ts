import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { useMemo } from "react";

export interface Vehicle {
  id: string;
  company_id: string;
  customer_id: string | null;
  license_plate: string;
  vin: string | null;
  brand: string | null;
  model: string | null;
  build_year: number | null;
  fuel_type: string | null;
  color: string | null;
  apk_expiry_date: string | null;
  registration_date: string | null;
  vehicle_mass: number | null;
  mileage_current: number | null;
  mileage_updated_at: string | null;
  notes: string | null;
  status: string;
  rdw_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  customers?: { name: string } | null;
}

export interface VehicleMileageLog {
  id: string;
  vehicle_id: string;
  company_id: string;
  mileage: number;
  recorded_at: string;
  work_order_id: string | null;
  recorded_by: string | null;
}

export const useVehicles = () => {
  const { companyId } = useAuth();
  const keys = useMemo(() => ["vehicles"], []);
  useRealtimeSubscription("vehicles", keys, companyId);
  return useQuery({
    queryKey: ["vehicles", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*, customers(name)")
        .order("license_plate");
      if (error) throw error;
      return data as Vehicle[];
    },
  });
};

export const useVehicle = (id: string | undefined) => {
  return useQuery({
    queryKey: ["vehicles", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*, customers(name)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as Vehicle | null;
    },
  });
};

export const useCustomerVehicles = (customerId: string | undefined) => {
  return useQuery({
    queryKey: ["vehicles", "customer", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .eq("customer_id", customerId!)
        .eq("status", "actief")
        .order("license_plate");
      if (error) throw error;
      return data as Vehicle[];
    },
  });
};

export const useCreateVehicle = () => {
  const qc = useQueryClient();
  const { companyId } = useAuth();
  return useMutation({
    mutationFn: async (vehicle: Partial<Vehicle>) => {
      const { data, error } = await supabase
        .from("vehicles")
        .insert({ ...vehicle, company_id: companyId } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vehicles"] }),
  });
};

export const useUpdateVehicle = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Vehicle> & { id: string }) => {
      const { data, error } = await supabase
        .from("vehicles")
        .update(updates as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vehicles"] }),
  });
};

export const useDeleteVehicle = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vehicles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vehicles"] }),
  });
};

export const useRdwLookup = () => {
  return useMutation({
    mutationFn: async (plate: string) => {
      const { data, error } = await supabase.functions.invoke("rdw-lookup", {
        body: { plate },
      });
      if (error) throw error;
      return data as {
        found: boolean;
        plate: string;
        brand?: string;
        model?: string;
        build_year?: number;
        fuel_type?: string;
        color?: string;
        vehicle_mass?: number;
        registration_date?: string;
        apk_expiry_date?: string;
        raw?: Record<string, unknown>;
      };
    },
  });
};

// Workshop bays
export interface WorkshopBay {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export const useWorkshopBays = () => {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["workshop_bays", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workshop_bays")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data as WorkshopBay[];
    },
  });
};

export const useCreateWorkshopBay = () => {
  const qc = useQueryClient();
  const { companyId } = useAuth();
  return useMutation({
    mutationFn: async (bay: Partial<WorkshopBay>) => {
      const { data, error } = await supabase
        .from("workshop_bays")
        .insert({ ...bay, company_id: companyId } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workshop_bays"] }),
  });
};

export const useUpdateWorkshopBay = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WorkshopBay> & { id: string }) => {
      const { data, error } = await supabase
        .from("workshop_bays")
        .update(updates as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workshop_bays"] }),
  });
};

export const useDeleteWorkshopBay = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workshop_bays").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workshop_bays"] }),
  });
};

// Vehicle mileage logs
export const useVehicleMileageLogs = (vehicleId: string | undefined) => {
  return useQuery({
    queryKey: ["vehicle_mileage_logs", vehicleId],
    enabled: !!vehicleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_mileage_logs")
        .select("*")
        .eq("vehicle_id", vehicleId!)
        .order("recorded_at", { ascending: false });
      if (error) throw error;
      return data as VehicleMileageLog[];
    },
  });
};

export const useCreateMileageLog = () => {
  const qc = useQueryClient();
  const { companyId } = useAuth();
  return useMutation({
    mutationFn: async (log: Partial<VehicleMileageLog>) => {
      const { data, error } = await supabase
        .from("vehicle_mileage_logs")
        .insert({ ...log, company_id: companyId } as any)
        .select()
        .single();
      if (error) throw error;

      // Also update current mileage on vehicle
      if (log.vehicle_id && log.mileage) {
        await supabase
          .from("vehicles")
          .update({ mileage_current: log.mileage, mileage_updated_at: new Date().toISOString() } as any)
          .eq("id", log.vehicle_id);
      }

      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["vehicle_mileage_logs"] });
      qc.invalidateQueries({ queryKey: ["vehicles"] });
    },
  });
};
