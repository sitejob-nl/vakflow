import type { Appointment } from "@/hooks/useAppointments";
import type { Tables } from "@/integrations/supabase/types";

type Service = Tables<"services">;

export interface CreateWorkOrderPayload {
  customer_id: string;
  service_id?: string;
  appointment_id: string;
  address_id?: string;
  assigned_to?: string;
  checklist: { label: string; checked: boolean }[];
  total_amount: number;
  status: string;
}

export function buildWorkOrderPayload(
  appointment: Appointment,
  services: Service[] | undefined,
): CreateWorkOrderPayload {
  const service = services?.find((s) => s.id === appointment.service_id);
  const checklistTemplate = (service as any)?.checklist_template;
  const checklist = Array.isArray(checklistTemplate)
    ? checklistTemplate.map((item: any) => ({
        label: typeof item === "string" ? item : item.label ?? item,
        checked: false,
      }))
    : [];

  return {
    customer_id: appointment.customer_id,
    service_id: appointment.service_id ?? undefined,
    appointment_id: appointment.id,
    address_id: (appointment as any).address_id ?? undefined,
    assigned_to: appointment.assigned_to ?? undefined,
    checklist,
    total_amount: service?.price ?? 0,
    status: "open",
  };
}
