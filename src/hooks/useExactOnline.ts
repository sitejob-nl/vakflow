import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ExactOnlineConnection {
  id: string;
  division_id: string;
  exact_division: number | null;
  is_active: boolean;
  connected_at: string | null;
  webhooks_enabled: boolean | null;
  tenant_id: string | null;
  company_name: string | null;
  region: string | null;
  company_id: string;
}

export function useExactOnlineConnections() {
  return useQuery({
    queryKey: ["exact-online-connections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exact_online_connections")
        .select("*")
        .order("connected_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ExactOnlineConnection[];
    },
  });
}

export function useTestExactConnection() {
  return useMutation({
    mutationFn: async (divisionId: string) => {
      const { data, error } = await supabase.functions.invoke("exact-api", {
        body: { divisionId, endpoint: "/current/Me", method: "GET" },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success("Verbinding actief", {
        description: data?.d?.FullName ? `Ingelogd als: ${data.d.FullName}` : "Token is geldig.",
      });
    },
    onError: (error) => toast.error("Verbinding mislukt", { description: error.message }),
  });
}

export function useRegisterExactTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("exact-register");
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data as { tenant_id: string; existing?: boolean };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exact-online-connections"] }),
    onError: (error) => toast.error(`Registratie mislukt: ${error.message}`),
  });
}

export function useDisconnectExact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (connectionId: string) => {
      const { error } = await supabase
        .from("exact_online_connections")
        .update({ is_active: false } as any)
        .eq("id", connectionId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exact-online-connections"] });
      toast.success("Exact Online verbinding ontkoppeld");
    },
    onError: (error) => toast.error(`Ontkoppelen mislukt: ${error.message}`),
  });
}

export function useSyncCustomersExact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ action, divisionId, customerId }: { action: "push" | "pull" | "sync"; divisionId: string; customerId?: string }) => {
      const { data, error } = await supabase.functions.invoke("exact-sync-customers", {
        body: { action, divisionId, customerId },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["exact-customers"] });
      if (vars.action === "push") {
        toast.success(`Klanten gepusht: ${data.created ?? 0} nieuw, ${data.updated ?? 0} bijgewerkt`);
      } else if (vars.action === "pull") {
        toast.success(`Klanten opgehaald: ${data.imported ?? 0} nieuw, ${data.updated ?? 0} bijgewerkt`);
      } else {
        toast.success("Klanten synchronisatie voltooid");
      }
    },
    onError: (error) => toast.error(`Sync fout: ${error.message}`),
  });
}

export function useSyncInvoicesExact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ action, divisionId, invoiceId }: { action: "push" | "pull_status" | "sync"; divisionId: string; invoiceId?: string }) => {
      const { data, error } = await supabase.functions.invoke("exact-sync-invoices", {
        body: { action, divisionId, invoiceId },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["exact-invoices"] });
      if (vars.action === "push") {
        toast.success(`Facturen gepusht: ${data.created ?? 0} aangemaakt`);
      } else if (vars.action === "pull_status") {
        toast.success(`Betaalstatussen bijgewerkt: ${data.updated ?? 0} gewijzigd`);
      } else {
        toast.success("Facturen synchronisatie voltooid");
      }
    },
    onError: (error) => toast.error(`Factuur sync fout: ${error.message}`),
  });
}

export function useSyncQuotesExact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ action, divisionId, quoteId }: { action: "push" | "pull_status"; divisionId: string; quoteId?: string }) => {
      const { data, error } = await supabase.functions.invoke("exact-sync-quotes", {
        body: { action, divisionId, quoteId },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["exact-quotes"] });
      if (vars.action === "push") {
        toast.success(`Offertes gepusht: ${data.created ?? 0} aangemaakt`);
      } else {
        toast.success(`Offerte-statussen bijgewerkt`);
      }
    },
    onError: (error) => toast.error(`Offerte sync fout: ${error.message}`),
  });
}

export function useSyncItemsExact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ action, divisionId }: { action: "push" | "pull" | "sync"; divisionId: string }) => {
      const { data, error } = await supabase.functions.invoke("exact-sync-items", {
        body: { action, divisionId },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ["materials"] });
      if (vars.action === "push") {
        toast.success(`Artikelen gepusht: ${data.created ?? 0} aangemaakt`);
      } else if (vars.action === "pull") {
        toast.success(`Artikelen gematcht: ${data.matched ?? 0} gekoppeld`);
      } else {
        toast.success("Artikelen synchronisatie voltooid");
      }
    },
    onError: (error) => toast.error(`Artikelen sync fout: ${error.message}`),
  });
}
