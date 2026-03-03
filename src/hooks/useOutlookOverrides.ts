import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface OutlookEventOverride {
  id: string;
  company_id: string;
  user_id: string;
  outlook_event_id: string;
  pinned: boolean;
  location_override: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
}

export const useOutlookOverrides = () => {
  const { companyId } = useAuth();

  return useQuery({
    queryKey: ["outlook-overrides", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outlook_event_overrides")
        .select("*");
      if (error) throw error;
      return (data ?? []) as unknown as OutlookEventOverride[];
    },
  });
};

export const useUpsertOutlookOverride = () => {
  const qc = useQueryClient();
  const { companyId, user } = useAuth();

  return useMutation({
    mutationFn: async (override: {
      outlook_event_id: string;
      pinned?: boolean;
      location_override?: string | null;
      lat?: number | null;
      lng?: number | null;
    }) => {
      const { data, error } = await supabase
        .from("outlook_event_overrides")
        .upsert(
          {
            company_id: companyId,
            user_id: user?.id,
            ...override,
          } as any,
          { onConflict: "outlook_event_id,user_id" }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["outlook-overrides"] }),
  });
};

export const usePersonalOutlookToken = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["personal-outlook-token", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_outlook_tokens")
        .select("outlook_email, created_at")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as { outlook_email: string | null; created_at: string } | null;
    },
  });
};

export const useDeletePersonalOutlookToken = () => {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("user_outlook_tokens")
        .delete()
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["personal-outlook-token"] }),
  });
};
