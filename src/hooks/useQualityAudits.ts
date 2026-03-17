import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface CriterionScore {
  id: string;
  name: string;
  score: number;
  max: number;
  weight: number;
}

export interface AuditRoomScore {
  id: string;
  audit_id: string;
  company_id: string;
  room_id: string | null;
  room_name: string;
  criteria: CriterionScore[];
  score: number | null;
  notes: string | null;
  created_at: string;
}

export interface QualityAudit {
  id: string;
  company_id: string;
  asset_id: string;
  auditor_id: string | null;
  audit_date: string;
  audit_type: string;
  overall_score: number | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  asset?: { id: string; name: string; object_type: string };
  auditor?: { full_name: string | null };
  room_scores?: AuditRoomScore[];
}

export const useAudits = (assetId?: string) => {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["quality_audits", companyId, assetId],
    queryFn: async () => {
      let query = supabase
        .from("quality_audits" as any)
        .select("*, asset:assets(id, name, object_type), auditor:profiles(full_name)")
        .eq("company_id", companyId!)
        .order("audit_date", { ascending: false });
      if (assetId) query = query.eq("asset_id", assetId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as QualityAudit[];
    },
    enabled: !!companyId,
  });
};

export const useAudit = (id: string | null) => {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["quality_audit", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quality_audits" as any)
        .select("*, asset:assets(id, name, object_type), auditor:profiles(full_name)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      const { data: scores } = await supabase
        .from("audit_room_scores" as any)
        .select("*")
        .eq("audit_id", id!)
        .order("created_at");
      return { ...(data as any), room_scores: scores || [] } as unknown as QualityAudit;
    },
    enabled: !!id && !!companyId,
  });
};

export const useCreateAudit = () => {
  const { companyId } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      asset_id: string;
      auditor_id?: string | null;
      audit_date: string;
      audit_type: string;
      overall_score?: number | null;
      notes?: string | null;
      status: string;
      room_scores: Array<{
        room_id: string | null;
        room_name: string;
        criteria: CriterionScore[];
        score: number | null;
        notes: string | null;
      }>;
    }) => {
      const { room_scores, ...auditData } = input;
      const { data, error } = await supabase
        .from("quality_audits" as any)
        .insert({ ...auditData, company_id: companyId! })
        .select("id")
        .single();
      if (error) throw error;
      const auditId = (data as any).id;
      if (room_scores.length > 0) {
        const { error: rsErr } = await supabase
          .from("audit_room_scores" as any)
          .insert(room_scores.map((rs) => ({ ...rs, audit_id: auditId, company_id: companyId! })));
        if (rsErr) throw rsErr;
      }
      return auditId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quality_audits"] });
      qc.invalidateQueries({ queryKey: ["cleaning_dashboard"] });
      qc.invalidateQueries({ queryKey: ["assets"] });
      toast.success("Inspectie opgeslagen");
    },
    onError: (e) => toast.error("Fout bij opslaan: " + e.message),
  });
};

export const useUpdateAudit = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<QualityAudit>) => {
      const { error } = await supabase
        .from("quality_audits" as any)
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quality_audits"] });
      qc.invalidateQueries({ queryKey: ["quality_audit"] });
      qc.invalidateQueries({ queryKey: ["cleaning_dashboard"] });
    },
  });
};

export const useDeleteAudit = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quality_audits" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quality_audits"] });
      qc.invalidateQueries({ queryKey: ["cleaning_dashboard"] });
      toast.success("Inspectie verwijderd");
    },
  });
};
