import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Customer = Tables<"customers"> & {
  services?: { name: string; color: string | null } | null;
};

/** Normalize Dutch phone numbers to international format without + prefix (e.g. 0629014011 → 31629014011) */
function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let cleaned = phone.replace(/[^0-9+]/g, "");
  if (cleaned.startsWith("06")) cleaned = "316" + cleaned.slice(2);
  if (cleaned.startsWith("00")) cleaned = cleaned.slice(2);
  if (cleaned.startsWith("+")) cleaned = cleaned.slice(1);
  return cleaned || null;
}

// Fire-and-forget sync customer to accounting provider
const syncCustomerToProvider = async (customerId: string, companyId: string | null) => {
  if (!companyId) return;
  try {
    const { data: company } = await supabase
      .from("companies_safe")
      .select("accounting_provider")
      .eq("id", companyId)
      .maybeSingle();

    const provider = company?.accounting_provider;
    if (!provider) return;

    let functionName: string | null = null;
    let body: Record<string, any> = { action: "sync-customer", customer_id: customerId };

    if (provider === "eboekhouden") functionName = "sync-invoice-eboekhouden";
    else if (provider === "rompslomp") functionName = "sync-rompslomp";
    else if (provider === "moneybird") functionName = "sync-moneybird";
    else if (provider === "exact") {
      functionName = "sync-exact";
      body = { action: "sync-single-contact", customer_id: customerId };
    } else if (provider === "wefact") {
      functionName = "sync-wefact";
      body = { action: "sync-customer", customer_id: customerId };
    } else if (provider === "snelstart") {
      functionName = "snelstart-sync";
      body = { action: "sync-customer", customer_id: customerId };
    }

    if (!functionName) return;

    const { error } = await supabase.functions.invoke(functionName, { body });
    if (error) console.warn(`${provider} klant sync mislukt:`, error.message);
  } catch (err: any) {
    console.warn("Klant sync mislukt:", err.message);
  }
};

export const useCustomers = () => {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["customers", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*, services:default_service_id(name, color)")
        .eq("company_id", companyId!)
        .order("name");
      if (error) throw error;
      return data as Customer[];
    },
  });
};

export interface PaginatedCustomersParams {
  page: number;
  pageSize: number;
  search?: string;
  typeFilter?: string | null;
  cityFilter?: string | null;
  serviceFilter?: string | null;
  sortKey?: "name" | "city" | "interval_months";
  sortDir?: "asc" | "desc";
}

export const usePaginatedCustomers = (params: PaginatedCustomersParams) => {
  const { companyId } = useAuth();
  const { page, pageSize, search, typeFilter, cityFilter, serviceFilter, sortKey = "name", sortDir = "asc" } = params;

  return useQuery({
    queryKey: ["customers-paginated", companyId, page, pageSize, search, typeFilter, cityFilter, serviceFilter, sortKey, sortDir],
    queryFn: async () => {
      const from = page * pageSize;
      const to = from + pageSize - 1;

      let q = supabase
        .from("customers")
        .select("*, services:default_service_id(name, color)", { count: "exact" });

      if (companyId) q = q.eq("company_id", companyId);
      if (typeFilter) q = q.eq("type", typeFilter);
      if (cityFilter) q = q.eq("city", cityFilter);

      if (search) {
        q = q.or(`name.ilike.%${search}%,city.ilike.%${search}%,email.ilike.%${search}%,address.ilike.%${search}%,postal_code.ilike.%${search}%`);
      }

      q = q.order(sortKey, { ascending: sortDir === "asc" });
      q = q.range(from, to);

      const { data, error, count } = await q;
      if (error) throw error;
      return { data: data as Customer[], totalCount: count ?? 0 };
    },
    placeholderData: (prev) => prev,
  });
};

export const useCustomer = (id: string | undefined) => {
  return useQuery({
    queryKey: ["customers", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*, services:default_service_id(name, color)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as Customer | null;
    },
  });
};

export const useCreateCustomer = () => {
  const qc = useQueryClient();
  const { companyId } = useAuth();
  return useMutation({
    mutationFn: async (customer: Omit<TablesInsert<"customers">, "company_id">) => {
      const normalized = { ...customer, phone: normalizePhone(customer.phone), company_id: companyId! };
      const { data, error } = await supabase.from("customers").insert(normalized as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      syncCustomerToProvider(data.id, companyId ?? null);
    },
  });
};

export const useUpdateCustomer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<"customers"> & { id: string }) => {
      if (updates.phone !== undefined) updates.phone = normalizePhone(updates.phone);
      const { data, error } = await supabase.from("customers").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      syncCustomerToProvider(data.id, data.company_id ?? null);
    },
  });
};

export const useDeleteCustomer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
};

export const useServices = () => {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["services", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("company_id", companyId!)
        .order("category")
        .order("price");
      if (error) throw error;
      return data;
    },
  });
};

export const useCreateService = () => {
  const qc = useQueryClient();
  const { companyId } = useAuth();
  return useMutation({
    mutationFn: async (service: { name: string; price: number; category?: string | null; color?: string | null; duration_minutes?: number }) => {
      const { data, error } = await supabase.from("services").insert({ ...service, company_id: companyId } as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["services"] }),
  });
};

export const useUpdateService = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; price?: number; category?: string | null; color?: string | null; duration_minutes?: number }) => {
      const { data, error } = await supabase.from("services").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["services"] }),
  });
};

export const useDeleteService = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("services").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["services"] }),
  });
};
