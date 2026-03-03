import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Invoice = Tables<"invoices"> & {
  customers?: { name: string; address: string | null; city: string | null; postal_code: string | null; email: string | null } | null;
  work_orders?: { work_order_number: string | null; services: { name: string; price: number } | null } | null;
};

const INV_QUERY_KEYS = ["invoices", "invoices-paginated"];

export const useInvoices = () => {
  const { companyId } = useAuth();
  const keys = useMemo(() => INV_QUERY_KEYS, []);
  useRealtimeSubscription("invoices", keys, companyId);
  return useQuery({
    queryKey: ["invoices", companyId],
    queryFn: async () => {
      let q = supabase
        .from("invoices")
        .select("*, customers(name, address, city, postal_code, email), work_orders(work_order_number, services(name, price))")
        .order("created_at", { ascending: false });
      if (companyId) q = q.eq("company_id", companyId);
      const { data, error } = await q;
      if (error) throw error;
      return data as Invoice[];
    },
  });
};

export interface PaginatedInvoicesParams {
  page: number;
  pageSize: number;
  statusFilter?: string | null;
}

export const usePaginatedInvoices = (params: PaginatedInvoicesParams) => {
  const { companyId } = useAuth();
  const { page, pageSize, statusFilter } = params;

  return useQuery({
    queryKey: ["invoices-paginated", companyId, page, pageSize, statusFilter],
    queryFn: async () => {
      const from = page * pageSize;
      const to = from + pageSize - 1;

      let q = supabase
        .from("invoices")
        .select("*, customers(name, address, city, postal_code, email), work_orders(work_order_number, services(name, price))", { count: "exact" })
        .order("created_at", { ascending: false });

      if (companyId) q = q.eq("company_id", companyId);

      if (statusFilter === "openstaand") {
        q = q.in("status", ["concept", "verzonden", "verlopen"]);
      } else if (statusFilter) {
        q = q.eq("status", statusFilter);
      }

      q = q.range(from, to);

      const { data, error, count } = await q;
      if (error) throw error;
      return { data: data as Invoice[], totalCount: count ?? 0 };
    },
    placeholderData: (prev) => prev,
  });
};

export const useInvoice = (id: string | undefined) => {
  return useQuery({
    queryKey: ["invoices", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, customers(name, address, city, postal_code, email), work_orders(work_order_number, services(name, price))")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as Invoice | null;
    },
  });
};

export const useCreateInvoice = () => {
  const qc = useQueryClient();
  const { companyId } = useAuth();
  return useMutation({
    mutationFn: async (invoice: TablesInsert<"invoices">) => {
      const { data, error } = await supabase.from("invoices").insert({ ...invoice, company_id: companyId } as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
  });
};

export const useUpdateInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<"invoices"> & { id: string }) => {
      const { data, error } = await supabase.from("invoices").update(updates).eq("id", id).select().single();
      if (error) throw error;

      // Trigger email automation when invoice is sent
      if (updates.status === "verzonden" && data.customer_id) {
        supabase.functions.invoke("trigger-email-automation", {
          body: {
            trigger_type: "invoice_sent",
            customer_id: data.customer_id,
            context: {
              factuurnummer: data.invoice_number || "",
              bedrag: data.total ? `€${Number(data.total).toFixed(2)}` : "",
            },
          },
        }).catch((err) => console.error("Email automation trigger failed:", err));
      }

      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
  });
};

export const useDeleteInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
  });
};

export const useSyncInvoiceEboekhouden = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const { data, error } = await supabase.functions.invoke("sync-invoice-eboekhouden", {
        body: { action: "sync", invoice_id: invoiceId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
  });
};

export const useSyncAllContactsEboekhouden = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-invoice-eboekhouden", {
        body: { action: "sync-all-contacts" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { synced: number; skipped: number; errors: string[] };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
};

export const useSyncAllInvoicesEboekhouden = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-invoice-eboekhouden", {
        body: { action: "sync-all-invoices" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { synced: number; skipped: number; errors: string[] };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
  });
};

export const usePullContactsEboekhouden = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-invoice-eboekhouden", {
        body: { action: "pull-contacts" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { updated: number; created: number; total: number; errors: string[] };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
};

export const usePullInvoicesEboekhouden = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-invoice-eboekhouden", {
        body: { action: "pull-invoices" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { total_in_eboekhouden: number; already_imported: number; imported: number; skipped_no_customer: number; skipped_invoices: any[]; errors: string[] };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
  });
};

export const usePullInvoiceStatusEboekhouden = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-invoice-eboekhouden", {
        body: { action: "pull-invoice-status" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { checked: number; updated: number; errors: string[] };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
  });
};

// === Rompslomp sync hooks ===

export const useSyncContactsRompslomp = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-rompslomp", {
        body: { action: "sync-contacts" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { synced: number; skipped: number; errors: string[] };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
};

export const useSyncInvoicesRompslomp = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-rompslomp", {
        body: { action: "sync-invoices" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { synced: number; skipped: number; errors: string[] };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
  });
};

export const usePullContactsRompslomp = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-rompslomp", {
        body: { action: "pull-contacts" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { total: number; created: number; updated: number; errors: string[] };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
};

export const usePullInvoicesRompslomp = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-rompslomp", {
        body: { action: "pull-invoices" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { total_in_rompslomp: number; already_imported: number; imported: number; skipped_no_customer: number; errors: string[] };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
  });
};

export const usePullInvoiceStatusRompslomp = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-rompslomp", {
        body: { action: "pull-invoice-status" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { checked: number; updated: number; errors: string[] };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
  });
};

export const useSyncQuotesRompslomp = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-rompslomp", {
        body: { action: "sync-quotes" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { synced: number; skipped: number; errors: string[] };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quotes"] }),
  });
};

export const usePullQuotesRompslomp = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-rompslomp", {
        body: { action: "pull-quotes" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { total_in_rompslomp: number; already_imported: number; imported: number; skipped_no_customer: number; errors: string[] };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quotes"] }),
  });
};

// === Moneybird sync hooks ===

export const useSyncContactsMoneybird = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-moneybird", {
        body: { action: "sync-contacts" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { synced: number; skipped: number; errors: string[] };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
};

export const usePullContactsMoneybird = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-moneybird", {
        body: { action: "pull-contacts" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { total: number; created: number; updated: number; errors: string[] };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
};

export const useSyncInvoicesMoneybird = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-moneybird", {
        body: { action: "sync-invoices" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { synced: number; skipped: number; errors: string[] };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
  });
};

export const usePullInvoicesMoneybird = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-moneybird", {
        body: { action: "pull-invoices" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { total_in_moneybird: number; already_imported: number; imported: number; skipped_no_customer: number; errors: string[] };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
  });
};

export const usePullInvoiceStatusMoneybird = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-moneybird", {
        body: { action: "pull-invoice-status" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { checked: number; updated: number; errors: string[] };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
  });
};

export const useSyncQuotesMoneybird = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-moneybird", {
        body: { action: "sync-quotes" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { synced: number; skipped: number; errors: string[] };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quotes"] }),
  });
};

export const usePullQuotesMoneybird = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-moneybird", {
        body: { action: "pull-quotes" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { total_in_moneybird: number; already_imported: number; imported: number; skipped_no_customer: number; errors: string[] };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quotes"] }),
  });
};
