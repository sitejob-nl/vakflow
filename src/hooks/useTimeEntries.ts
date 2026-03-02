import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface TimeEntry {
  id: string;
  company_id: string | null;
  work_order_id: string | null;
  user_id: string;
  started_at: string;
  stopped_at: string | null;
  duration_minutes: number | null;
  description: string | null;
  is_travel: boolean;
  created_at: string;
}

export const useTimeEntries = (workOrderId?: string) => {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["time_entries", workOrderId ?? "all", companyId],
    queryFn: async () => {
      let q = supabase
        .from("time_entries")
        .select("*")
        .order("started_at", { ascending: false });
      if (workOrderId) q = q.eq("work_order_id", workOrderId);
      if (companyId) q = q.eq("company_id", companyId);
      const { data, error } = await q;
      if (error) throw error;
      return data as TimeEntry[];
    },
  });
};

export const useActiveTimer = (workOrderId: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["time_entries", "active", workOrderId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .eq("work_order_id", workOrderId)
        .eq("user_id", user!.id)
        .is("stopped_at", null)
        .maybeSingle();
      if (error) throw error;
      return data as TimeEntry | null;
    },
  });
};

export const useStartTimer = () => {
  const qc = useQueryClient();
  const { companyId, user } = useAuth();
  return useMutation({
    mutationFn: async ({ workOrderId, isTravel = false }: { workOrderId: string; isTravel?: boolean }) => {
      const { data, error } = await supabase
        .from("time_entries")
        .insert({
          work_order_id: workOrderId,
          user_id: user!.id,
          company_id: companyId,
          is_travel: isTravel,
          started_at: new Date().toISOString(),
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["time_entries"] }),
  });
};

export const useStopTimer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entryId: string) => {
      const stoppedAt = new Date();
      // First get started_at to calculate duration
      const { data: entry, error: fetchErr } = await supabase
        .from("time_entries")
        .select("started_at")
        .eq("id", entryId)
        .single();
      if (fetchErr) throw fetchErr;

      const startedAt = new Date(entry.started_at);
      const durationMinutes = Math.round((stoppedAt.getTime() - startedAt.getTime()) / 60000);

      const { data, error } = await supabase
        .from("time_entries")
        .update({
          stopped_at: stoppedAt.toISOString(),
          duration_minutes: durationMinutes,
        })
        .eq("id", entryId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["time_entries"] }),
  });
};

export const useDeleteTimeEntry = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("time_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["time_entries"] }),
  });
};
