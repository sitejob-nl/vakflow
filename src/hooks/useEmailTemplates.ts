import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface EmailTemplate {
  id: string;
  company_id: string;
  name: string;
  subject: string | null;
  html_body: string;
  variables: string[];
  created_at: string;
  updated_at: string;
}

export function useEmailTemplates() {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["email_templates", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates" as any)
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as EmailTemplate[];
    },
  });
}

export function useCreateEmailTemplate() {
  const { companyId } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (template: Pick<EmailTemplate, "name" | "subject" | "html_body" | "variables">) => {
      const { error } = await supabase
        .from("email_templates" as any)
        .insert({ ...template, company_id: companyId } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email_templates"] }),
  });
}

export function useUpdateEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<EmailTemplate> & { id: string }) => {
      const { error } = await supabase
        .from("email_templates" as any)
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email_templates"] }),
  });
}

export function useDeleteEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("email_templates" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email_templates"] }),
  });
}
