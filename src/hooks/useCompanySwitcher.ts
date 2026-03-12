import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface UserCompany {
  company_id: string;
  company_name: string;
  company_slug: string;
  role: "admin" | "monteur" | "super_admin";
  is_default: boolean;
  is_active: boolean;
}

export function useCompanySwitcher() {
  const [companies, setCompanies] = useState<UserCompany[]>([]);
  const [activeCompany, setActiveCompany] = useState<UserCompany | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);

  const fetchCompanies = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_my_companies");
    if (error) {
      console.error("Failed to fetch companies:", error);
      setIsLoading(false);
      return;
    }
    const typed = (data || []) as UserCompany[];
    setCompanies(typed);
    setActiveCompany(typed.find((c) => c.is_active) || null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const switchCompany = useCallback(
    async (companyId: string) => {
      if (activeCompany?.company_id === companyId) return true;
      setIsSwitching(true);
      try {
        const { data, error } = await supabase.rpc("switch_company", {
          target_company_id: companyId,
        });
        if (error) throw error;
        const result = data as unknown as { success: boolean; error?: string };
        if (!result.success) {
          console.error("Switch failed:", result.error);
          return false;
        }
        window.location.reload();
        return true;
      } catch (err) {
        console.error("Switch company error:", err);
        return false;
      } finally {
        setIsSwitching(false);
      }
    },
    [activeCompany]
  );

  return {
    companies,
    activeCompany,
    switchCompany,
    hasMultipleCompanies: companies.length > 1,
    isLoading,
    isSwitching,
  };
}
