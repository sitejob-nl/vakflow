import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Hook to get sync queue status
export function useExactSyncQueueStatus() {
  return useQuery({
    queryKey: ["exact-sync-queue-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exact_sync_queue")
        .select("status")
        .in("status", ["pending", "processing"]);

      if (error) throw error;
      return {
        pending: data?.filter((r) => r.status === "pending").length || 0,
        processing: data?.filter((r) => r.status === "processing").length || 0,
      };
    },
    refetchInterval: 30000, // Poll every 30s
  });
}

// Hook to test Exact connection
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
    onError: (error) => {
      toast.error("Verbinding mislukt", { description: error.message });
    },
  });
}

// Hook to check webhook status
export function useCheckWebhookStatus() {
  return useMutation({
    mutationFn: async (divisionId: string) => {
      const { data, error } = await supabase.functions.invoke("exact-webhooks-manage", {
        body: { action: "status", divisionId },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
  });
}

interface ExactOnlineConnection {
  id: string;
  division_id: string;
  exact_division: number | null;
  is_active: boolean;
  connected_at: string | null;
  webhooks_enabled: boolean | null;
  tenant_id: string | null;
  company_name: string | null;
  region: string | null;
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
      return data as unknown as ExactOnlineConnection[];
    },
  });
}

export function useRegisterExactTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (divisionId: string) => {
      const { data, error } = await supabase.functions.invoke("exact-register-tenant", {
        body: { divisionId },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data as { tenant_id: string; success: boolean; already_registered?: boolean };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exact-online-connections"] });
    },
    onError: (error) => {
      toast.error(`Fout bij registratie: ${error.message}`);
    },
  });
}

export function useDisconnectExact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (connectionId: string) => {
      const { error } = await supabase
        .from("exact_online_connections")
        .update({ is_active: false })
        .eq("id", connectionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exact-online-connections"] });
      toast.success("Exact Online verbinding ontkoppeld");
    },
    onError: (error) => {
      toast.error(`Fout bij ontkoppelen: ${error.message}`);
    },
  });
}

export function useExactApi() {
  return useMutation({
    mutationFn: async ({
      divisionId,
      endpoint,
      method = "GET",
      body,
    }: {
      divisionId: string;
      endpoint: string;
      method?: string;
      body?: object;
    }) => {
      const { data, error } = await supabase.functions.invoke("exact-api", {
        body: { divisionId, endpoint, method, body },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data;
    },
  });
}

export function useManageWebhooks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      action,
      divisionId,
    }: {
      action: "subscribe" | "unsubscribe" | "status";
      divisionId: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("exact-webhooks-manage", {
        body: { action, divisionId },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["exact-online-connections"] });
      if (variables.action === "subscribe") {
        toast.success("Webhooks ingeschakeld");
      } else if (variables.action === "unsubscribe") {
        toast.success("Webhooks uitgeschakeld");
      }
    },
    onError: (error) => {
      toast.error(`Webhook fout: ${error.message}`);
    },
  });
}

export function useSyncCustomers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      action,
      divisionId,
      customerId,
    }: {
      action: "push" | "pull" | "sync";
      divisionId: string;
      customerId?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("exact-sync-customers", {
        body: { action, divisionId, customerId },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      
      if (variables.action === "push") {
        const msg = `Klanten gepusht: ${data.created} nieuw, ${data.updated} bijgewerkt`;
        if (data.failed > 0) {
          toast.warning(`${msg}, ${data.failed} mislukt`);
        } else {
          toast.success(msg);
        }
      } else if (variables.action === "pull") {
        const msg = `Klanten opgehaald: ${data.imported} nieuw, ${data.updated} bijgewerkt`;
        toast.success(msg);
      } else {
        toast.success("Synchronisatie voltooid");
      }
    },
    onError: (error) => {
      toast.error(`Sync fout: ${error.message}`);
    },
  });
}

export function useSyncSalesOrders() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      action,
      divisionId,
      orderId,
    }: {
      action: "push";
      divisionId: string;
      orderId?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("exact-sync-sales-orders", {
        body: { action, divisionId, orderId },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });

      const msg = `Verkooporders gepusht: ${data.created} aangemaakt`;
      if (data.failed > 0) {
        toast.warning(`${msg}, ${data.failed} mislukt`);
      } else {
        toast.success(msg);
      }
    },
    onError: (error) => {
      toast.error(`Verkooporder sync fout: ${error.message}`);
    },
  });
}

export function useSyncPurchaseOrders() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      action,
      divisionId,
      supplierOrderId,
    }: {
      action: "push";
      divisionId: string;
      supplierOrderId?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("exact-sync-purchase-orders", {
        body: { action, divisionId, supplierOrderId },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["supplier-orders"] });

      const msg = `Inkooporders gepusht: ${data.created} aangemaakt`;
      if (data.failed > 0) {
        toast.warning(`${msg}, ${data.failed} mislukt`);
      } else {
        toast.success(msg);
      }
    },
    onError: (error) => {
      toast.error(`Inkooporder sync fout: ${error.message}`);
    },
  });
}

export function useSyncInvoices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      action,
      divisionId,
      orderId,
    }: {
      action: "push" | "pull_status" | "sync";
      divisionId: string;
      orderId?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("exact-sync-invoices", {
        body: { action, divisionId, orderId },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice-stats"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      
      if (variables.action === "push") {
        const msg = `Facturen gepusht: ${data.created} aangemaakt`;
        if (data.failed > 0) {
          toast.warning(`${msg}, ${data.failed} mislukt`);
        } else {
          toast.success(msg);
        }
      } else if (variables.action === "pull_status") {
        toast.success(`Betalingsstatussen bijgewerkt: ${data.updated} gewijzigd`);
      } else {
        const pushMsg = data.pushed ? `${data.pushed.created} facturen gepusht` : "";
        const pullMsg = data.pulled ? `${data.pulled.updated} statussen bijgewerkt` : "";
        toast.success(`Synchronisatie voltooid: ${[pushMsg, pullMsg].filter(Boolean).join(", ")}`);
      }
    },
    onError: (error) => {
      toast.error(`Factuur sync fout: ${error.message}`);
    },
  });
}

export function useSyncContacts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      action,
      divisionId,
    }: {
      action: "push" | "pull" | "sync";
      divisionId: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("exact-sync-contacts", {
        body: { action, divisionId },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      
      if (variables.action === "push") {
        const msg = `Contacten gepusht: ${data.created} nieuw, ${data.updated} bijgewerkt`;
        if (data.failed > 0) toast.warning(`${msg}, ${data.failed} mislukt`);
        else toast.success(msg);
      } else if (variables.action === "pull") {
        toast.success(`Contacten opgehaald: ${data.updated} bijgewerkt`);
      } else {
        toast.success("Contactpersonen synchronisatie voltooid");
      }
    },
    onError: (error) => {
      toast.error(`Contacten sync fout: ${error.message}`);
    },
  });
}

export function useSyncQuotes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      action,
      divisionId,
      quoteId,
    }: {
      action: "push" | "pull_status";
      divisionId: string;
      quoteId?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("exact-sync-quotes", {
        body: { action, divisionId, quoteId },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      
      if (variables.action === "push") {
        const msg = `Offertes gepusht: ${data.created} aangemaakt`;
        if (data.failed > 0) toast.warning(`${msg}, ${data.failed} mislukt`);
        else toast.success(msg);
      } else {
        toast.success(`Offerte-statussen bijgewerkt: ${data.updated} gewijzigd`);
      }
    },
    onError: (error) => {
      toast.error(`Offerte sync fout: ${error.message}`);
    },
  });
}

export function useSyncItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      action,
      divisionId,
    }: {
      action: "push" | "pull" | "sync";
      divisionId: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("exact-sync-items", {
        body: { action, divisionId },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      
      if (variables.action === "push") {
        const msg = `Artikelen gepusht: ${data.created} aangemaakt`;
        if (data.failed > 0) toast.warning(`${msg}, ${data.failed} mislukt`);
        else toast.success(msg);
      } else if (variables.action === "pull") {
        toast.success(`Artikelen gematcht: ${data.matched} gekoppeld`);
      } else {
        toast.success("Artikelen synchronisatie voltooid");
      }
    },
    onError: (error) => {
      toast.error(`Artikelen sync fout: ${error.message}`);
    },
  });
}
