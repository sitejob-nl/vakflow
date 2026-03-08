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
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["quotes", companyId],
    queryFn: async () => {
      let q = supabase
        .from("quotes")
        .select("*, customers(name, address, city, postal_code, email)")
        .order("created_at", { ascending: false });
      if (companyId) q = q.eq("company_id", companyId);
      const { data, error } = await q;
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

export const useConvertQuoteToContract = () => {
  const qc = useQueryClient();
  const { companyId } = useAuth();
  return useMutation({
    mutationFn: async (quote: Quote) => {
      const totalPrice = quote.total;
      const payload = {
        company_id: companyId!,
        customer_id: quote.customer_id,
        name: `Contract o.b.v. offerte ${quote.quote_number || quote.id.slice(0, 8)}`,
        description: quote.items.map((i) => i.description).filter(Boolean).join(", "),
        price: totalPrice,
        interval_months: 12,
        start_date: new Date().toISOString().split("T")[0],
        next_due_date: new Date().toISOString().split("T")[0],
        status: "actief",
        asset_id: (quote as any).asset_id || null,
      };
      const { data, error } = await supabase
        .from("contracts")
        .insert(payload as any)
        .select("id")
        .single();
      if (error) throw error;

      // Link quote to contract
      await supabase.from("quotes").update({ contract_id: data.id, status: "geaccepteerd" } as any).eq("id", quote.id);

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["contracts"] });
    },
  });
};
