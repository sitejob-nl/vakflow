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
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*, customers(name, address, city, postal_code, email)")
        .eq("company_id", companyId!)
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

export const useConvertQuoteToWorkOrder = () => {
  const qc = useQueryClient();
  const { companyId } = useAuth();
  return useMutation({
    mutationFn: async (quote: Quote) => {
      const woPayload = {
        company_id: companyId!,
        customer_id: quote.customer_id,
        quote_id: quote.id,
        asset_id: (quote as any).asset_id || null,
        description: quote.items.map((i) => `${i.description} (${i.qty}x)`).filter(Boolean).join("\n"),
        total_amount: quote.total,
        status: "open",
      };
      const { data: wo, error: woError } = await supabase
        .from("work_orders")
        .insert(woPayload as any)
        .select("id, work_order_number")
        .single();
      if (woError) throw woError;

      for (const item of quote.items) {
        if (!item.description) continue;
        await supabase.from("work_order_materials").insert({
          work_order_id: wo.id,
          company_id: companyId!,
          name: item.description,
          unit: "stuk",
          quantity: item.qty || 1,
          unit_price: item.unit_price || 0,
          total: (item.qty || 1) * (item.unit_price || 0),
        } as any);
      }

      await supabase
        .from("quotes")
        .update({ status: "geaccepteerd" } as any)
        .eq("id", quote.id);

      return wo;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["work_orders"] });
    },
  });
};

export const useConvertQuoteToInvoice = () => {
  const qc = useQueryClient();
  const { companyId } = useAuth();
  return useMutation({
    mutationFn: async (quote: Quote) => {
      const vatPct = Number(quote.vat_percentage || 21);
      const items = quote.items.map((item) => ({
        description: item.description || "Item",
        qty: item.qty || 1,
        unit_price: item.unit_price || 0,
        total: (item.qty || 1) * (item.unit_price || 0),
      }));

      const totalIncl = items.reduce((sum, i) => sum + i.total, 0);
      const subtotal = Math.round((totalIncl / (1 + vatPct / 100)) * 100) / 100;
      const vatAmount = Math.round((totalIncl - subtotal) * 100) / 100;

      const today = new Date().toISOString().split("T")[0];
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      const { data, error } = await supabase
        .from("invoices")
        .insert({
          company_id: companyId!,
          customer_id: quote.customer_id,
          quote_id: quote.id,
          items: items as any,
          optional_items: quote.optional_items as any,
          subtotal,
          vat_percentage: vatPct,
          vat_amount: vatAmount,
          total: totalIncl,
          status: "concept",
          issued_at: today,
          due_at: dueDate.toISOString().split("T")[0],
          notes: quote.notes || null,
        } as any)
        .select("id, invoice_number")
        .single();
      if (error) throw error;

      await supabase
        .from("quotes")
        .update({ status: "geaccepteerd" } as any)
        .eq("id", quote.id);

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
};

export const useConvertQuoteToContract = () => {
  // ... keep existing code
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
      await supabase.from("quotes").update({ contract_id: data.id, status: "geaccepteerd" } as any).eq("id", quote.id);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["contracts"] });
    },
  });
};

export const useConvertQuoteToProject = () => {
  const qc = useQueryClient();
  const { companyId } = useAuth();
  return useMutation({
    mutationFn: async (quote: Quote) => {
      const payload = {
        company_id: companyId!,
        customer_id: quote.customer_id,
        quote_id: quote.id,
        name: `Project o.b.v. offerte ${quote.quote_number || quote.id.slice(0, 8)}`,
        description: quote.items.map((i) => i.description).filter(Boolean).join(", "),
        budget_amount: quote.total,
        asset_id: (quote as any).asset_id || null,
        status: "gepland",
      };
      const { data, error } = await supabase
        .from("projects" as any)
        .insert(payload)
        .select("id, project_number")
        .single();
      if (error) throw error;
      await supabase.from("quotes").update({ status: "geaccepteerd" } as any).eq("id", quote.id);
      return data as unknown as { id: string; project_number: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
};
