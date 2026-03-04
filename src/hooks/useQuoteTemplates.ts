import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { QuoteItem, OptionalItem } from "@/hooks/useQuotes";
import type { TemplateBlock } from "@/components/QuoteTemplateBuilder";

export interface QuoteTemplateDB {
  id: string;
  user_id: string;
  name: string;
  items: QuoteItem[];
  optional_items: OptionalItem[];
  blocks: TemplateBlock[] | null;
  created_at: string;
  updated_at: string;
}

export interface CombinedTemplate {
  id: string;
  name: string;
  items: QuoteItem[];
  optionalItems: OptionalItem[];
  isCustom: boolean;
}

const QUERY_KEY = ["quote_templates"];

export const useQuoteTemplatesDB = () => {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quote_templates")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data as any[]).map((t) => ({
        ...t,
        items: Array.isArray(t.items) ? t.items : [],
        optional_items: Array.isArray(t.optional_items) ? t.optional_items : [],
        blocks: Array.isArray(t.blocks) ? t.blocks : null,
      })) as QuoteTemplateDB[];
    },
  });
};

export const useCombinedTemplates = () => {
  const { data: dbTemplates, isLoading } = useQuoteTemplatesDB();

  const combined: CombinedTemplate[] = (dbTemplates ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    items: t.items,
    optionalItems: t.optional_items,
    isCustom: true,
  }));

  return { data: combined, isLoading };
};

export const useCreateQuoteTemplate = () => {
  const qc = useQueryClient();
  const { user, companyId } = useAuth();
  return useMutation({
    mutationFn: async (tpl: { name: string; items: QuoteItem[]; optional_items: OptionalItem[]; blocks?: TemplateBlock[] }) => {
      const { data, error } = await supabase
        .from("quote_templates")
        .insert({ ...tpl, user_id: user!.id, company_id: companyId } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
};

export const useUpdateQuoteTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; items?: QuoteItem[]; optional_items?: OptionalItem[]; blocks?: TemplateBlock[] }) => {
      const { data, error } = await supabase
        .from("quote_templates")
        .update(updates as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
};

export const useDeleteQuoteTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quote_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
};
