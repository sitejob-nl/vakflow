import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface LeadStatus {
  id: string;
  company_id: string;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
}

export interface LeadFormField {
  id: string;
  company_id: string;
  field_name: string;
  field_label: string;
  field_type: string;
  is_required: boolean;
  sort_order: number;
  options: any;
  created_at: string;
}

export interface Lead {
  id: string;
  company_id: string;
  status_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  source: string | null;
  value: number;
  notes: string | null;
  custom_fields: Record<string, any>;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// --- STATUSES ---

export const useLeadStatuses = () => {
  return useQuery({
    queryKey: ["lead_statuses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_statuses")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data as LeadStatus[];
    },
  });
};

export const useUpsertLeadStatus = () => {
  const qc = useQueryClient();
  const { companyId } = useAuth();
  return useMutation({
    mutationFn: async (status: Partial<LeadStatus> & { name: string }) => {
      if (status.id) {
        const { error } = await supabase.from("lead_statuses").update(status).eq("id", status.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("lead_statuses").insert({ ...status, company_id: companyId! });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead_statuses"] }),
  });
};

export const useDeleteLeadStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lead_statuses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead_statuses"] }),
  });
};

export const useReorderLeadStatuses = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (statuses: { id: string; sort_order: number }[]) => {
      for (const s of statuses) {
        await supabase.from("lead_statuses").update({ sort_order: s.sort_order }).eq("id", s.id);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead_statuses"] }),
  });
};

// --- FORM FIELDS ---

export const useLeadFormFields = () => {
  return useQuery({
    queryKey: ["lead_form_fields"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_form_fields")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data as LeadFormField[];
    },
  });
};

export const useUpsertLeadFormField = () => {
  const qc = useQueryClient();
  const { companyId } = useAuth();
  return useMutation({
    mutationFn: async (field: Partial<LeadFormField> & { field_name: string; field_label: string }) => {
      if (field.id) {
        const { error } = await supabase.from("lead_form_fields").update(field).eq("id", field.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("lead_form_fields").insert({ ...field, company_id: companyId! });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead_form_fields"] }),
  });
};

export const useDeleteLeadFormField = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lead_form_fields").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead_form_fields"] }),
  });
};

// --- LEADS ---

export const useLeads = () => {
  return useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data as Lead[];
    },
  });
};

export const useCreateLead = () => {
  const qc = useQueryClient();
  const { companyId } = useAuth();
  return useMutation({
    mutationFn: async (lead: Partial<Lead> & { name: string; status_id: string }) => {
      const { error } = await supabase.from("leads").insert({ ...lead, company_id: companyId! });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
};

export const useUpdateLead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Lead> & { id: string }) => {
      const { error } = await supabase.from("leads").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
};

export const useDeleteLead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
};
