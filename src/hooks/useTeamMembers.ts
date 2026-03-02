import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface TeamMember {
  id: string;
  full_name: string | null;
}

export const useTeamMembers = () => {
  const { companyId } = useAuth();

  return useQuery({
    queryKey: ["team-members", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("company_id", companyId!)
        .order("full_name");
      if (error) throw error;
      return data as TeamMember[];
    },
  });
};
