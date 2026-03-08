import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ApkReminderSettings {
  id: string;
  company_id: string;
  enabled: boolean;
  channel: string;
  days_before: number[];
  email_subject: string;
  email_body: string;
  created_at: string;
  updated_at: string;
}

export interface ApkReminderLog {
  id: string;
  company_id: string;
  vehicle_id: string;
  customer_id: string;
  reminder_type: string;
  channel: string;
  apk_expiry_date: string;
  sent_at: string;
}

const settingsTable = () => supabase.from("apk_reminder_settings" as any);
const logsTable = () => supabase.from("apk_reminder_logs" as any);

export const useApkReminderSettings = () => {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["apk_reminder_settings", companyId],
    queryFn: async () => {
      const { data, error } = await settingsTable()
        .select("*")
        .eq("company_id", companyId!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as ApkReminderSettings | null;
    },
    enabled: !!companyId,
  });
};

export const useUpsertApkReminderSettings = () => {
  const qc = useQueryClient();
  const { companyId } = useAuth();
  return useMutation({
    mutationFn: async (settings: Partial<ApkReminderSettings>) => {
      const { data, error } = await settingsTable()
        .upsert(
          { ...settings, company_id: companyId, updated_at: new Date().toISOString() },
          { onConflict: "company_id" }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["apk_reminder_settings"] }),
  });
};

export const useApkReminderLogs = (limit = 20) => {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["apk_reminder_logs", companyId, limit],
    queryFn: async () => {
      const { data, error } = await logsTable()
        .select("*")
        .eq("company_id", companyId!)
        .order("sent_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as ApkReminderLog[];
    },
    enabled: !!companyId,
  });
};

export const useRunApkReminderScan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("apk-reminder-scan");
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["apk_reminder_logs"] }),
  });
};
