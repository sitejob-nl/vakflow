import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useClickToDial() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ phone_number, customer_id }: { phone_number: string; customer_id?: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Niet ingelogd");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voys-click-to-dial`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ phone_number, customer_id }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gesprek starten mislukt");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Gesprek wordt opgezet", description: data.message || "Je telefoon gaat zo over." });
    },
    onError: (err: Error) => {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    },
  });
}
