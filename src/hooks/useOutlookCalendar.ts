import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface OutlookEvent {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  location?: { displayName?: string };
  bodyPreview?: string;
  isAllDay?: boolean;
  showAs?: string;
  categories?: string[];
}

export const useOutlookCalendar = (startDate: Date, endDate: Date, enabled: boolean) => {
  const { companyId } = useAuth();

  return useQuery({
    queryKey: ["outlook-calendar", startDate.toISOString(), endDate.toISOString(), companyId],
    enabled: enabled && !!companyId,
    staleTime: 5 * 60 * 1000, // 5 min cache
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("outlook-calendar", {
        body: {
          action: "list",
          startDateTime: startDate.toISOString(),
          endDateTime: endDate.toISOString(),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return (data as OutlookEvent[]) ?? [];
    },
  });
};
