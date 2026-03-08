import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Project {
  id: string;
  company_id: string;
  customer_id: string;
  quote_id: string | null;
  address_id: string | null;
  asset_id: string | null;
  assigned_to: string | null;
  name: string;
  description: string | null;
  project_number: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  deadline: string | null;
  budget_amount: number;
  notes: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  customers?: { name: string } | null;
}

export interface ProjectPhase {
  id: string;
  project_id: string;
  company_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  status: string;
  start_date: string | null;
  end_date: string | null;
  budget_amount: number;
  created_at: string;
}

export const useProjects = () => {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["projects", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects" as any)
        .select("*, customers(name)")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Project[];
    },
  });
};

export const useProject = (id: string | undefined) => {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["project", id],
    enabled: !!id && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects" as any)
        .select("*, customers(name, address, city, postal_code, email, phone)")
        .eq("id", id!)
        .eq("company_id", companyId!)
        .single();
      if (error) throw error;
      return data as unknown as Project;
    },
  });
};

export const useProjectPhases = (projectId: string | undefined) => {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["project_phases", projectId],
    enabled: !!projectId && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_phases" as any)
        .select("*")
        .eq("project_id", projectId!)
        .eq("company_id", companyId!)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as unknown as ProjectPhase[];
    },
  });
};

export const useProjectStats = (projectId: string | undefined) => {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["project_stats", projectId],
    enabled: !!projectId && !!companyId,
    queryFn: async () => {
      const [invoicesRes, workOrdersRes, timeRes] = await Promise.all([
        supabase
          .from("invoices")
          .select("total, status")
          .eq("project_id" as any, projectId!)
          .eq("company_id", companyId!) as any,
        supabase
          .from("work_orders")
          .select("id, status")
          .eq("project_id" as any, projectId!)
          .eq("company_id", companyId!) as any,
        supabase
          .from("time_entries")
          .select("duration_minutes")
          .eq("project_id" as any, projectId!)
          .eq("company_id" as any, companyId!) as any,
      ]);

      const invoices = invoicesRes.data ?? [];
      const workOrders = workOrdersRes.data ?? [];
      const timeEntries = timeRes.data ?? [];

      const totalInvoiced = invoices.reduce((s, i) => s + Number(i.total || 0), 0);
      const totalPaid = invoices
        .filter((i) => i.status === "betaald")
        .reduce((s, i) => s + Number(i.total || 0), 0);
      const totalHoursMinutes = timeEntries.reduce((s, t) => s + (t.duration_minutes || 0), 0);
      const workOrderCount = workOrders.length;
      const completedWorkOrders = workOrders.filter((w) => w.status === "afgerond").length;

      return {
        totalInvoiced,
        totalPaid,
        totalHoursMinutes,
        workOrderCount,
        completedWorkOrders,
        invoiceCount: invoices.length,
      };
    },
  });
};

export const useProjectWorkOrders = (projectId: string | undefined) => {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["project_work_orders", projectId],
    enabled: !!projectId && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_orders")
        .select("id, work_order_number, status, description, total_amount, created_at, customers(name)")
        .eq("project_id" as any, projectId!)
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
};

export const useProjectInvoices = (projectId: string | undefined) => {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["project_invoices", projectId],
    enabled: !!projectId && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_number, status, total, created_at, customers(name)")
        .eq("project_id", projectId!)
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
};

export const useProjectAppointments = (projectId: string | undefined) => {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["project_appointments", projectId],
    enabled: !!projectId && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, scheduled_at, duration_minutes, status, notes, customers(name)")
        .eq("project_id", projectId!)
        .eq("company_id", companyId!)
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });
};

export const useCreateProject = () => {
  const qc = useQueryClient();
  const { companyId } = useAuth();
  return useMutation({
    mutationFn: async (project: Partial<Project>) => {
      const { data, error } = await supabase
        .from("projects" as any)
        .insert({ ...project, company_id: companyId! })
        .select("id, project_number")
        .single();
      if (error) throw error;
      return data as unknown as { id: string; project_number: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
};

export const useUpdateProject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<Project>) => {
      const { error } = await supabase
        .from("projects" as any)
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project"] });
    },
  });
};

export const useDeleteProject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
};

export const useCreateProjectPhase = () => {
  const qc = useQueryClient();
  const { companyId } = useAuth();
  return useMutation({
    mutationFn: async (phase: Partial<ProjectPhase>) => {
      const { data, error } = await supabase
        .from("project_phases" as any)
        .insert({ ...phase, company_id: companyId! })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project_phases"] }),
  });
};

export const useUpdateProjectPhase = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<ProjectPhase>) => {
      const { error } = await supabase
        .from("project_phases" as any)
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project_phases"] }),
  });
};

export const useDeleteProjectPhase = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_phases" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project_phases"] }),
  });
};
