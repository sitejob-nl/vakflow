import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useMetaConfig() {
  const queryClient = useQueryClient();

  const configQuery = useQuery({
    queryKey: ["meta-config"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("meta-api", {
        body: { action: "get-config" },
      });
      if (error) throw error;
      return data;
    },
  });

  const statusQuery = useQuery({
    queryKey: ["meta-status"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("meta-api", {
        body: { action: "status" },
      });
      if (error) return { connected: false, page_id: null };
      return data;
    },
  });

  const saveConfig = useMutation({
    mutationFn: async (config: {
      app_id?: string;
      app_secret?: string;
      page_access_token?: string;
      page_id?: string;
      instagram_account_id?: string;
      webhook_verify_token?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("meta-api", {
        body: { action: "save-config", ...config },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-config"] });
      queryClient.invalidateQueries({ queryKey: ["meta-status"] });
    },
  });

  return { configQuery, statusQuery, saveConfig };
}
