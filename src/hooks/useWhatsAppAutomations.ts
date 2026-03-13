import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface WhatsAppAutomation {
  id: string;
  user_id: string;
  name: string;
  trigger_type: string;
  template_name: string;
  template_language: string;
  variable_mapping: Record<string, string>;
  conditions: Record<string, any>;
  is_active: boolean;
  cooldown_hours: number;
  created_at: string;
  updated_at: string;
}

export const TRIGGER_TYPES = [
  { value: "appointment_created", label: "Afspraak aangemaakt" },
  { value: "work_order_completed", label: "Werkbon afgerond" },
  { value: "invoice_sent", label: "Factuur verzonden" },
  { value: "review_request", label: "Reviewverzoek" },
  { value: "repeat_reminder", label: "Herhaalherinnering" },
  // Lead automations
  { value: "lead_created", label: "Nieuwe lead aangemaakt" },
  { value: "lead_status_changed", label: "Lead status gewijzigd" },
  { value: "lead_inactive", label: "Lead inactief" },
] as const;

export const AVAILABLE_VARIABLES: Record<string, { label: string; path: string }[]> = {
  appointment_created: [
    { label: "Klantnaam", path: "customer.name" },
    { label: "Datum", path: "appointment.date" },
    { label: "Tijd", path: "appointment.time" },
    { label: "Dienst", path: "appointment.service" },
  ],
  work_order_completed: [
    { label: "Klantnaam", path: "customer.name" },
    { label: "Werkbonnummer", path: "work_order.number" },
    { label: "Dienst", path: "work_order.service" },
  ],
  invoice_sent: [
    { label: "Klantnaam", path: "customer.name" },
    { label: "Factuurnummer", path: "invoice.number" },
    { label: "Bedrag", path: "invoice.total" },
  ],
  review_request: [
    { label: "Klantnaam", path: "customer.name" },
  ],
  repeat_reminder: [
    { label: "Klantnaam", path: "customer.name" },
    { label: "Laatste reiniging", path: "reminder.last_service_date" },
    { label: "Interval (mnd)", path: "reminder.interval_months" },
  ],
  lead_created: [
    { label: "Leadnaam", path: "lead.name" },
    { label: "E-mail", path: "lead.email" },
    { label: "Telefoon", path: "lead.phone" },
    { label: "Bron", path: "lead.source" },
    { label: "Bedrijfsnaam", path: "lead.company_name" },
  ],
  lead_status_changed: [
    { label: "Leadnaam", path: "lead.name" },
    { label: "E-mail", path: "lead.email" },
    { label: "Telefoon", path: "lead.phone" },
    { label: "Nieuwe status", path: "lead.status" },
    { label: "Vorige status", path: "lead.previous_status" },
    { label: "Bron", path: "lead.source" },
  ],
  lead_inactive: [
    { label: "Leadnaam", path: "lead.name" },
    { label: "E-mail", path: "lead.email" },
    { label: "Telefoon", path: "lead.phone" },
    { label: "Dagen inactief", path: "lead.days_inactive" },
    { label: "Laatste activiteit", path: "lead.last_activity" },
  ],
};

export function useWhatsAppAutomations() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["whatsapp-automations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_automations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as WhatsAppAutomation[];
    },
    enabled: !!user,
  });
}

export function useCreateAutomation() {
  const qc = useQueryClient();
  const { user, companyId } = useAuth();
  return useMutation({
    mutationFn: async (automation: Omit<WhatsAppAutomation, "id" | "user_id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("whatsapp_automations")
        .insert({ ...automation, user_id: user!.id, company_id: companyId } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["whatsapp-automations"] }),
  });
}

export function useUpdateAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WhatsAppAutomation> & { id: string }) => {
      const { error } = await supabase
        .from("whatsapp_automations")
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["whatsapp-automations"] }),
  });
}

export function useDeleteAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("whatsapp_automations")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["whatsapp-automations"] }),
  });
}

export function useAutomationSendLogs(triggerType?: string) {
  return useQuery({
    queryKey: ["automation-send-logs", triggerType],
    queryFn: async () => {
      let query = supabase
        .from("automation_send_log")
        .select("*, whatsapp_automations(name), customers(name)")
        .order("sent_at", { ascending: false })
        .limit(100);
      if (triggerType) {
        query = query.eq("trigger_type", triggerType);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}
