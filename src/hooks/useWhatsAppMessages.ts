import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export type WhatsAppMessage = {
  id: string;
  direction: string;
  from_number: string | null;
  to_number: string | null;
  content: string | null;
  type: string | null;
  status: string | null;
  customer_id: string | null;
  metadata: any;
  created_at: string | null;
  wamid: string | null;
  sent_by: string | null;
  customers?: { name: string } | null;
};

export const useWhatsAppMessages = (customerId?: string) => {
  const queryClient = useQueryClient();

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`whatsapp-messages-${customerId ?? "all"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_messages",
          ...(customerId ? { filter: `customer_id=eq.${customerId}` } : {}),
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["whatsapp-messages", customerId ?? "all"],
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [customerId, queryClient]);

  return useQuery({
    queryKey: ["whatsapp-messages", customerId ?? "all"],
    queryFn: async () => {
      let query = supabase
        .from("whatsapp_messages")
        .select("*")
        .order("created_at", { ascending: false });

      if (customerId) {
        query = query.eq("customer_id", customerId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as WhatsAppMessage[];
    },
  });
};
