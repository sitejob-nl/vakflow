import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WhatsAppTemplate {
  id?: string;
  name: string;
  status: string;
  category: string;
  language: string;
  components: any[];
  quality_score: { score: string; date: number } | null;
  parameter_format: string; // "POSITIONAL" or "NAMED"
}

export function useWhatsAppTemplates(enabled = true) {
  return useQuery<WhatsAppTemplate[]>({
    queryKey: ["whatsapp-templates"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("whatsapp-send", {
        body: { action: "templates" },
      });
      if (error) throw new Error("WhatsApp API error");
      if (data?.error) throw new Error(data.error);
      return data.templates || [];
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useCreateWhatsAppTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      name: string;
      category: string;
      language: string;
      components?: any[];
      parameter_format?: string;
      library_template_name?: string;
      library_template_button_inputs?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("whatsapp-templates", {
        body: { action: "create", ...body },
      });
      if (error) throw new Error("Template aanmaken mislukt");
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
    },
  });
}

export function useEditWhatsAppTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      template_id: string;
      components?: any[];
      category?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("whatsapp-templates", {
        body: { action: "edit", ...body },
      });
      if (error) throw new Error("Template bewerken mislukt");
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
    },
  });
}

export function useDeleteWhatsAppTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (templateName: string) => {
      const { data, error } = await supabase.functions.invoke("whatsapp-templates", {
        body: { action: "delete", template_name: templateName },
      });
      if (error) throw new Error("Template verwijderen mislukt");
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
    },
  });
}
