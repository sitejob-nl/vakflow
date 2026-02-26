import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type CommunicationLog = Tables<"communication_logs"> & {
  customers?: { name: string } | null;
};

export const useCommunicationLogs = (customerId?: string) => {
  return useQuery({
    queryKey: ["communication_logs", customerId ?? "all"],
    queryFn: async () => {
      let query = supabase
        .from("communication_logs")
        .select("*, customers:customer_id(name)")
        .order("sent_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (customerId) {
        query = query.eq("customer_id", customerId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CommunicationLog[];
    },
  });
};

export const useCreateCommunicationLog = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (log: TablesInsert<"communication_logs">) => {
      const { data, error } = await supabase
        .from("communication_logs")
        .insert(log)
        .select("*, customers:customer_id(name)")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["communication_logs"] }),
  });
};

export const useDeleteCommunicationLog = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("communication_logs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["communication_logs"] }),
  });
};

export const useSendEmail = () => {
  return useMutation({
    mutationFn: async (params: { to: string; subject: string; body: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Niet ingelogd");

      const res = await fetch(
        `https://hhozgcmkickfdesnlpgs.supabase.co/functions/v1/send-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(params),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Verzending mislukt");
      return json;
    },
  });
};
