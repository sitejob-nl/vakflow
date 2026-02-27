import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Invoice = Tables<"invoices"> & {
  customers?: { name: string; address: string | null; city: string | null; postal_code: string | null; email: string | null } | null;
  work_orders?: { work_order_number: string | null; services: { name: string; price: number } | null } | null;
};

export const useInvoices = () => {
  return useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, customers(name, address, city, postal_code, email), work_orders(work_order_number, services(name, price))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Invoice[];
    },
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
