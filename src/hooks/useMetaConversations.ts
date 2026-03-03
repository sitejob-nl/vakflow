import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useMetaConversations(platform?: "messenger" | "instagram") {
  const { companyId } = useAuth();
  const queryClient = useQueryClient();

  const conversationsQuery = useQuery({
    queryKey: ["meta-conversations", companyId, platform],
    enabled: !!companyId,
    queryFn: async () => {
      let query = supabase
        .from("meta_conversations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (platform) query = query.eq("platform", platform);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const sendMessage = useMutation({
    mutationFn: async ({ recipient_id, message, platform: msgPlatform }: { recipient_id: string; message: string; platform: string }) => {
      const { data, error } = await supabase.functions.invoke("meta-api", {
        body: { action: "send-message", recipient_id, message, platform: msgPlatform },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["meta-conversations"] }),
  });

  return { conversationsQuery, sendMessage };
}
