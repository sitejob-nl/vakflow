import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Appointment = Tables<"appointments"> & {
  customers?: { name: string; address: string | null; postal_code: string | null; city: string | null; lat: number | null; lng: number | null } | null;
  services?: { name: string; color: string | null; price: number } | null;
  profiles?: { full_name: string | null } | null;
  addresses?: { street: string | null; house_number: string | null; apartment: string | null; postal_code: string | null; city: string | null; notes: string | null } | null;
  travel_time_minutes?: number | null;
  start_location_label?: string | null;
};

export const useAppointments = (weekStart: Date, weekEnd: Date) => {
  const queryClient = useQueryClient();
  const { companyId } = useAuth();

  useEffect(() => {
    const channel = supabase
      .channel("appointments-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => {
        queryClient.invalidateQueries({ queryKey: ["appointments"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return useQuery({
    queryKey: ["appointments", weekStart.toISOString(), weekEnd.toISOString(), companyId],
    queryFn: async () => {
      let q = supabase
        .from("appointments")
        .select("*, customers(name, address, postal_code, city, lat, lng), services(name, color, price), profiles:assigned_to(full_name), addresses(street, house_number, apartment, postal_code, city, notes)")
        .gte("scheduled_at", weekStart.toISOString())
        .lt("scheduled_at", weekEnd.toISOString())
        .order("scheduled_at");
      if (companyId) q = q.eq("company_id", companyId);
      const { data, error } = await q;
      if (error) throw error;
      return data as Appointment[];
    },
  });
};

export const useAppointmentsForDay = (date: Date | null, assignedTo?: string | null) => {
  const dayStart = date ? new Date(date.getFullYear(), date.getMonth(), date.getDate()) : null;
  const dayEnd = dayStart ? new Date(dayStart.getTime() + 86400000) : null;

  return useQuery({
    queryKey: ["appointments-day", dayStart?.toISOString(), assignedTo],
    enabled: !!dayStart,
    queryFn: async () => {
      let q = supabase
        .from("appointments")
        .select("*, customers(name, address, postal_code, city, lat, lng)")
        .gte("scheduled_at", dayStart!.toISOString())
        .lt("scheduled_at", dayEnd!.toISOString())
        .order("scheduled_at");
      if (assignedTo) {
        q = q.eq("assigned_to", assignedTo);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as Appointment[];
    },
  });
};

export const useCreateAppointment = () => {
  const qc = useQueryClient();
  const { companyId } = useAuth();
  return useMutation({
    mutationFn: async (appointment: TablesInsert<"appointments">) => {
      const { data, error } = await supabase.from("appointments").insert({ ...appointment, company_id: companyId } as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments"] }),
  });
};

export const useUpdateAppointment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<"appointments"> & { id: string }) => {
      const { data, error } = await supabase.from("appointments").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments"] }),
  });
};

export const useDeleteAppointment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments"] }),
  });
};
