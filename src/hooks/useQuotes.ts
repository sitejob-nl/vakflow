import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface QuoteItem {
  description: string;
  qty: number;
  unit_price: number;
  total: number;
}

export interface OptionalItem {
  description: string;
  price: number;
}

export interface Quote {
  id: string;
  quote_number: string | null;
  customer_id: string;
  status: string;
  items: QuoteItem[];
  optional_items: OptionalItem[];
  subtotal: number;
  vat_percentage: number;
  vat_amount: number;
  total: number;
  issued_at: string | null;
  valid_until: string | null;
  notes: string | null;
  user_id: string;
  created_at: string;
  customers?: { name: string; address: string | null; city: string | null; postal_code: string | null; email: string | null } | null;
}

export const useQuotes = () => {
  return useQuery({
    queryKey: ["quotes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*, customers(name, address, city, postal_code, email)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]).map((q) => ({
        ...q,
        items: Array.isArray(q.items) ? q.items : [],
        optional_items: Array.isArray(q.optional_items) ? q.optional_items : [],
      })) as Quote[];
    },
  });
};

export const useCreateQuote = () => {
  const qc = useQueryClient();
  const { user, companyId } = useAuth();
  return useMutation({
    mutationFn: async (quote: Omit<Quote, "id" | "quote_number" | "created_at" | "user_id" | "customers">) => {
      const { data, error } = await supabase
        .from("quotes")
        .insert({ ...quote, user_id: user!.id, company_id: companyId } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quotes"] }),
  });
};

export const useUpdateQuote = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<Quote>) => {
      const { data, error } = await supabase
        .from("quotes")
        .update(updates as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quotes"] }),
  });
};

export const useDeleteQuote = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quotes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quotes"] }),
  });
};

export const useSyncQuoteEboekhouden = () => {
  return useMutation({
    mutationFn: async (quoteId: string) => {
      const { data, error } = await supabase.functions.invoke("sync-invoice-eboekhouden", {
        body: { action: "sync-quote", quote_id: quoteId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
  });
};
