import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface Asset {
  id: string;
  company_id: string | null;
  customer_id: string | null;
  address_id: string | null;
  name: string;
  asset_type: string | null;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  install_date: string | null;
  last_maintenance_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // CleanFlow fields
  object_type: string;
  frequency: string | null;
  frequency_days: number[] | null;
  next_service_due: string | null;
  surface_area: number | null;
  vehicle_count: number | null;
  facilities: string[] | null;
  access_instructions: string | null;
  // custom fields
  custom_fields: Record<string, any> | null;
  // joined
  customer?: { id: string; name: string } | null;
  address?: { id: string; street: string | null; house_number: string | null; city: string | null } | null;
}

export interface MaintenanceLog {
  id: string;
  company_id: string | null;
  asset_id: string;
  work_order_id: string | null;
  maintenance_date: string;
  description: string | null;
  performed_by: string | null;
  created_at: string;
  profile?: { full_name: string | null } | null;
  work_order?: { work_order_number: string | null } | null;
}

export interface ObjectRoom {
  id: string;
  asset_id: string;
  company_id: string;
  name: string;
  room_type: string | null;
  checklist: any[];
  sort_order: number;
  created_at: string;
}

export interface FleetVehicleType {
  id: string;
  asset_id: string;
  company_id: string;
  vehicle_type: string;
  count: number;
  price_per_unit: number;
  created_at: string;
  updated_at: string;
}

export const useAssets = () => {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["assets", companyId],
    queryFn: async () => {
      let q = supabase
        .from("assets" as any)
        .select("*, customer:customers(id, name), address:addresses(id, street, house_number, city)")
        .order("name");
      if (companyId) q = q.eq("company_id", companyId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Asset[];
    },
    enabled: !!companyId,
  });
};

export const useAsset = (id: string | undefined) => {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["assets", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets" as any)
        .select("*, customer:customers(id, name), address:addresses(id, street, house_number, city)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as unknown as Asset;
    },
    enabled: !!id && !!companyId,
  });
};

export const useMaintenanceLogs = (assetId: string | undefined) => {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["maintenance_logs", assetId, companyId],
    queryFn: async () => {
      let q = supabase
        .from("asset_maintenance_logs" as any)
        .select("*, profile:profiles(full_name), work_order:work_orders(work_order_number)")
        .eq("asset_id", assetId!)
        .order("maintenance_date", { ascending: false });
      if (companyId) q = q.eq("company_id", companyId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as MaintenanceLog[];
    },
    enabled: !!assetId,
  });
};

export const useCreateAsset = () => {
  const qc = useQueryClient();
  const { companyId } = useAuth();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: Partial<Asset>) => {
      const { data, error } = await supabase
        .from("assets" as any)
        .insert({ ...input, company_id: companyId } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
      toast({ title: "Object aangemaakt" });
    },
    onError: (e: any) => toast({ title: "Fout", description: e.message, variant: "destructive" }),
  });
};

export const useUpdateAsset = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<Asset> & { id: string }) => {
      const { error } = await supabase
        .from("assets" as any)
        .update(input as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
      toast({ title: "Object bijgewerkt" });
    },
    onError: (e: any) => toast({ title: "Fout", description: e.message, variant: "destructive" }),
  });
};

export const useDeleteAsset = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("assets" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
      toast({ title: "Object verwijderd" });
    },
    onError: (e: any) => toast({ title: "Fout", description: e.message, variant: "destructive" }),
  });
};

export const useCreateMaintenanceLog = () => {
  const qc = useQueryClient();
  const { companyId } = useAuth();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: Partial<MaintenanceLog>) => {
      const { data, error } = await supabase
        .from("asset_maintenance_logs" as any)
        .insert({ ...input, company_id: companyId } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maintenance_logs"] });
      qc.invalidateQueries({ queryKey: ["assets"] });
      toast({ title: "Onderhoudslog toegevoegd" });
    },
    onError: (e: any) => toast({ title: "Fout", description: e.message, variant: "destructive" }),
  });
};

export const useDeleteMaintenanceLog = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("asset_maintenance_logs" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maintenance_logs"] });
      toast({ title: "Log verwijderd" });
    },
    onError: (e: any) => toast({ title: "Fout", description: e.message, variant: "destructive" }),
  });
};

// ─── Object Rooms (Ruimtes) ────────────────────────────────

export const useObjectRooms = (assetId: string | undefined) => {
  return useQuery({
    queryKey: ["object_rooms", assetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("object_rooms" as any)
        .select("*")
        .eq("asset_id", assetId!)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as ObjectRoom[];
    },
    enabled: !!assetId,
  });
};

export const useCreateObjectRoom = () => {
  const qc = useQueryClient();
  const { companyId } = useAuth();
  return useMutation({
    mutationFn: async (input: Partial<ObjectRoom>) => {
      const { data, error } = await supabase
        .from("object_rooms" as any)
        .insert({ ...input, company_id: companyId } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["object_rooms"] }),
  });
};

export const useUpdateObjectRoom = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<ObjectRoom> & { id: string }) => {
      const { error } = await supabase
        .from("object_rooms" as any)
        .update(input as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["object_rooms"] }),
  });
};

export const useDeleteObjectRoom = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("object_rooms" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["object_rooms"] }),
  });
};

// ─── Fleet Vehicle Types ───────────────────────────────────

export const useFleetVehicleTypes = (assetId: string | undefined) => {
  return useQuery({
    queryKey: ["fleet_vehicle_types", assetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fleet_vehicle_types" as any)
        .select("*")
        .eq("asset_id", assetId!)
        .order("vehicle_type");
      if (error) throw error;
      return (data ?? []) as unknown as FleetVehicleType[];
    },
    enabled: !!assetId,
  });
};

export const useCreateFleetVehicleType = () => {
  const qc = useQueryClient();
  const { companyId } = useAuth();
  return useMutation({
    mutationFn: async (input: Partial<FleetVehicleType>) => {
      const { data, error } = await supabase
        .from("fleet_vehicle_types" as any)
        .insert({ ...input, company_id: companyId } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fleet_vehicle_types"] }),
  });
};

export const useUpdateFleetVehicleType = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<FleetVehicleType> & { id: string }) => {
      const { error } = await supabase
        .from("fleet_vehicle_types" as any)
        .update(input as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fleet_vehicle_types"] }),
  });
};

export const useDeleteFleetVehicleType = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fleet_vehicle_types" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fleet_vehicle_types"] }),
  });
};
