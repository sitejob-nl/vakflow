import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AiConversation {
  id: string;
  company_id: string;
  phone_number: string;
  trigger_type: string;
  status: string;
  current_step: number | null;
  messages: any[] | null;
  collected_data: Record<string, any> | null;
  routed_to: string | null;
  escalation_reason: string | null;
  customer_id: string | null;
  lead_id: string | null;
  call_record_id: string | null;
  work_order_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  expires_at: string | null;
  customer?: { name: string; phone: string | null } | null;
}

export function useAiConversations() {
  const { session, companyId } = useAuth();
  const queryClient = useQueryClient();

  const conversationsQuery = useQuery({
    queryKey: ["ai-conversations", companyId],
    enabled: !!session && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_conversations")
        .select("*, customer:customers!ai_conversations_customer_id_fkey(name, phone)")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as AiConversation[];
    },
    refetchInterval: 10_000,
  });

  const maxTurnsQuery = useQuery({
    queryKey: ["ai-agent-max-turns", companyId],
    enabled: !!session && !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_agent_config")
        .select("max_turns")
        .eq("company_id", companyId!)
        .maybeSingle();
      return data?.max_turns ?? 10;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("ai_conversations")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai-conversations"] }),
  });

  return {
    conversations: conversationsQuery.data ?? [],
    isLoading: conversationsQuery.isLoading,
    maxTurns: maxTurnsQuery.data ?? 10,
    updateStatus,
  };
}
