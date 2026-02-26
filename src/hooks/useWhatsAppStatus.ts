import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useWhatsAppStatus() {
  return useQuery({
    queryKey: ["whatsapp-config-status"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("whatsapp-send", {
        body: { action: "status" },
      });
      if (error || !data?.connected) return { connected: false, phone: null, tenant_id: null };
      return { connected: true, phone: data.phone || null, tenant_id: data.tenant_id || null };
    },
  });
}
