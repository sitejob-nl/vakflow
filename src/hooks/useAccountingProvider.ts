import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useAccountingProvider() {
  const { companyId } = useAuth();

  const { data: provider = null } = useQuery({
    queryKey: ["accounting-provider", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data } = await supabase
        .from("companies_safe" as any)
        .select("accounting_provider")
        .eq("id", companyId)
        .single() as { data: any };
      return (data?.accounting_provider as string) ?? null;
    },
    enabled: !!companyId,
    staleTime: 60_000,
  });

  return provider;
}
