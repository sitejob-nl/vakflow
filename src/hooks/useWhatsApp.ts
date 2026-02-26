import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useWhatsApp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: Record<string, unknown>) => {
      const { data, error } = await supabase.functions.invoke("whatsapp-send", {
        body: params,
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("WhatsApp bericht verstuurd");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-messages"] });
      queryClient.invalidateQueries({ queryKey: ["communication_logs"] });
    },
    onError: (error: Error) => {
      toast.error(`Versturen mislukt: ${error.message}`);
    },
  });
}
