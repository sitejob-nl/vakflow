import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useSnelstartConnection() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["snelstart-connection"],
    enabled: !!user,
    queryFn: async () => {
      const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user!.id).single();
      if (!profile?.company_id) return null;
      const { data } = await supabase
        .from("snelstart_connections" as any)
        .select("id, company_id, created_at, updated_at, token_expires_at")
        .eq("company_id", profile.company_id)
        .maybeSingle();
      return data;
    },
  });
}

export function useSaveSnelstartConnection() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ clientKey, subscriptionKey }: { clientKey: string; subscriptionKey: string }) => {
      const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user!.id).single();
      if (!profile?.company_id) throw new Error("Geen bedrijf gevonden");
      const { error } = await supabase.from("snelstart_connections" as any).upsert(
        {
          company_id: profile.company_id,
          client_key: clientKey,
          subscription_key: subscriptionKey,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "company_id" }
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["snelstart-connection"] }),
  });
}

export function useTestSnelstartConnection() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("snelstart-relaties", {
        method: "GET",
        body: undefined,
      });
      // We just need to see if the call succeeds (auth + token works)
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return { ok: true, count: Array.isArray(data) ? data.length : 0 };
    },
  });
}

export function useDeleteSnelstartConnection() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user!.id).single();
      if (!profile?.company_id) throw new Error("Geen bedrijf gevonden");
      const { error } = await supabase.from("snelstart_connections" as any).delete().eq("company_id", profile.company_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["snelstart-connection"] });
      qc.invalidateQueries({ queryKey: ["snelstart-sync-status"] });
    },
  });
}

export function useSnelstartSyncStatus() {
  const { data: connection } = useSnelstartConnection();
  return useQuery({
    queryKey: ["snelstart-sync-status", connection?.id],
    enabled: !!connection?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("snelstart_sync_status" as any)
        .select("*")
        .eq("connection_id", (connection as any).id)
        .order("resource_type");
      return data ?? [];
    },
    refetchInterval: 10000, // Poll every 10s while viewing
  });
}

export function useTriggerSnelstartSync() {
  const { data: connection } = useSnelstartConnection();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (syncType: "delta" | "full" = "full") => {
      const { data, error } = await supabase.functions.invoke("snelstart-sync", {
        body: { sync_type: syncType, connection_id: (connection as any)?.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["snelstart-sync-status"] }),
  });
}
