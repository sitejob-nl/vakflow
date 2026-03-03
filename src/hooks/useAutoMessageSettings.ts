import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type MessageType =
  | "appointment_confirmation"
  | "work_order_summary"
  | "review_request"
  | "repeat_reminder";

export interface AutoMessageSetting {
  id: string;
  user_id: string;
  message_type: MessageType;
  enabled: boolean;
  channel: "whatsapp" | "email" | "both";
  template_name: string | null;
  custom_text: string | null;
  delay_hours: number;
  email_template_id: string | null;
}

const MESSAGE_TYPES: MessageType[] = [
  "appointment_confirmation",
  "work_order_summary",
  "review_request",
  "repeat_reminder",
];

const LABELS: Record<MessageType, string> = {
  appointment_confirmation: "Afspraakbevestiging",
  work_order_summary: "Werkbon samenvatting",
  review_request: "Reviewverzoek",
  repeat_reminder: "Herhaalreminder",
};

export { MESSAGE_TYPES, LABELS };

export function useAutoMessageSettings() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["auto_message_settings", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auto_message_settings" as any)
        .select("*")
        .eq("user_id", user!.id);
      if (error) throw error;

      const existing = (data || []) as unknown as AutoMessageSetting[];
      const map = new Map(existing.map((s) => [s.message_type, s]));

      return MESSAGE_TYPES.map((type) => {
        if (map.has(type)) return map.get(type)!;
        return {
          id: "",
          user_id: user!.id,
          message_type: type,
          enabled: true,
          channel: "whatsapp" as const,
          template_name: null,
          custom_text: null,
          delay_hours: 0,
          email_template_id: null,
        };
      });
    },
  });
}

export function useUpsertAutoMessageSetting() {
  const { user, companyId } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (setting: Omit<AutoMessageSetting, "id" | "user_id">) => {
      const payload = { ...setting, user_id: user!.id, company_id: companyId };
      const { error } = await supabase
        .from("auto_message_settings" as any)
        .upsert(payload as any, { onConflict: "user_id,message_type" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auto_message_settings"] });
    },
  });
}
