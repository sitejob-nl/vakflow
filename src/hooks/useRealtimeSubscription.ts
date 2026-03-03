import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type TableName = "work_orders" | "invoices";

/**
 * Subscribe to Supabase Realtime changes on a table and
 * automatically invalidate the related React-Query cache.
 */
export const useRealtimeSubscription = (
  table: TableName,
  queryKeys: string[],
  companyId: string | null | undefined
) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel(`realtime-${table}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          // Invalidate all query keys related to this table
          queryKeys.forEach((key) => {
            queryClient.invalidateQueries({ queryKey: [key] });
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, companyId, queryClient, queryKeys]);
};
