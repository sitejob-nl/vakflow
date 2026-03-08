import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Appointment = Tables<"appointments"> & {
  customers?: { name: string; address: string | null; postal_code: string | null; city: string | null; lat: number | null; lng: number | null } | null;
  services?: { name: string; color: string | null; price: number } | null;
  profiles?: { full_name: string | null } | null;
  addresses?: { street: string | null; house_number: string | null; apartment: string | null; postal_code: string | null; city: string | null; notes: string | null } | null;
  travel_time_minutes?: number | null;
  start_location_label?: string | null;
};

// Helper: sync appointment to assigned user's Outlook calendar
async function syncToOutlook(appointment: any, action: "create" | "update" | "delete", customers?: any[], services?: any[]) {
  if (!appointment.assigned_to) return null;

  try {
    if (action === "delete") {
      if (!appointment.outlook_event_id) return null;
      await supabase.functions.invoke("outlook-calendar", {
        body: {
          action: "delete",
          eventId: appointment.outlook_event_id,
          targetUserId: appointment.assigned_to,
        },
      });
      return null;
    }

    // Build Outlook event object
    const scheduledAt = new Date(appointment.scheduled_at);
    const endAt = new Date(scheduledAt.getTime() + (appointment.duration_minutes || 60) * 60 * 1000);

    const customer = customers?.find((c: any) => c.id === appointment.customer_id);
    const service = services?.find((s: any) => s.id === appointment.service_id);

    const subject = [service?.name, customer?.name].filter(Boolean).join(" — ") || "Vakflow afspraak";
    const location = customer ? [customer.address, customer.postal_code, customer.city].filter(Boolean).join(", ") : "";

    const event = {
      subject,
      start: { dateTime: scheduledAt.toISOString(), timeZone: "Europe/Amsterdam" },
      end: { dateTime: endAt.toISOString(), timeZone: "Europe/Amsterdam" },
      location: { displayName: location },
      body: { contentType: "Text", content: appointment.notes || "" },
      categories: ["Vakflow"],
    };

    if (action === "create") {
      const { data, error } = await supabase.functions.invoke("outlook-calendar", {
        body: { action: "create", event, targetUserId: appointment.assigned_to },
      });
      if (error) throw error;
      // Return the Outlook event ID to store
      return data?.id || null;
    }

    if (action === "update" && appointment.outlook_event_id) {
      await supabase.functions.invoke("outlook-calendar", {
        body: {
          action: "update",
          eventId: appointment.outlook_event_id,
          event,
          targetUserId: appointment.assigned_to,
        },
      });
    }
  } catch (e) {
    console.warn("Outlook sync failed (non-blocking):", e);
    // Import dynamically to avoid circular deps
    const { toast } = await import("@/hooks/use-toast");
    toast({ title: "Outlook sync mislukt", description: "De afspraak is opgeslagen, maar niet gesynchroniseerd met Outlook.", variant: "destructive" });
  }
  return null;
}

export const useAppointments = (weekStart: Date, weekEnd: Date) => {
  const queryClient = useQueryClient();
  const { companyId, user, role } = useAuth();
  const isMonteur = role === "monteur";

  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel("appointments-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments", filter: `company_id=eq.${companyId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["appointments"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient, companyId]);

  return useQuery({
    queryKey: ["appointments", weekStart.toISOString(), weekEnd.toISOString(), companyId, isMonteur ? user?.id : null],
    enabled: !!companyId,
    queryFn: async () => {
      let q = supabase
        .from("appointments")
        .select("*, customers(name, address, postal_code, city, lat, lng), services(name, color, price), profiles:assigned_to(full_name), addresses(street, house_number, apartment, postal_code, city, notes)")
        .eq("company_id", companyId!)
        .gte("scheduled_at", weekStart.toISOString())
        .lt("scheduled_at", weekEnd.toISOString())
        .order("scheduled_at");
      if (isMonteur && user?.id) q = q.eq("assigned_to", user.id);
      const { data, error } = await q;
      if (error) throw error;
      return data as Appointment[];
    },
  });
};

export const useAppointmentsForDay = (date: Date | null, assignedTo?: string | null) => {
  const { companyId } = useAuth();
  const dayStart = date ? new Date(date.getFullYear(), date.getMonth(), date.getDate()) : null;
  const dayEnd = dayStart ? new Date(dayStart.getTime() + 86400000) : null;

  return useQuery({
    queryKey: ["appointments-day", dayStart?.toISOString(), assignedTo, companyId],
    enabled: !!dayStart,
    queryFn: async () => {
      let q = supabase
        .from("appointments")
        .select("*, customers(name, address, postal_code, city, lat, lng)")
        .gte("scheduled_at", dayStart!.toISOString())
        .lt("scheduled_at", dayEnd!.toISOString())
        .order("scheduled_at");
      if (companyId) q = q.eq("company_id", companyId);
      if (assignedTo) {
        q = q.eq("assigned_to", assignedTo);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as Appointment[];
    },
  });
};

export const useCreateAppointment = () => {
  const qc = useQueryClient();
  const { companyId } = useAuth();
  return useMutation({
    mutationFn: async (appointment: Omit<TablesInsert<"appointments">, "company_id"> & { _syncOutlook?: boolean; _customers?: any[]; _services?: any[] }) => {
      const { _syncOutlook, _customers, _services, ...apptData } = appointment;
      const { data, error } = await supabase.from("appointments").insert({ ...apptData, company_id: companyId! } as any).select().single();
      if (error) throw error;

      // Sync to Outlook if requested
      if (_syncOutlook !== false && data.assigned_to) {
        const outlookEventId = await syncToOutlook(data, "create", _customers, _services);
        if (outlookEventId) {
          await supabase.from("appointments").update({ outlook_event_id: outlookEventId }).eq("id", data.id);
          data.outlook_event_id = outlookEventId;
        }
      }

      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments"] }),
  });
};

export const useUpdateAppointment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, _syncOutlook, _customers, _services, ...updates }: TablesUpdate<"appointments"> & { id: string; _syncOutlook?: boolean; _customers?: any[]; _services?: any[] }) => {
      const { data, error } = await supabase.from("appointments").update(updates).eq("id", id).select().single();
      if (error) throw error;

      // Sync update to Outlook
      if (_syncOutlook !== false && data.assigned_to) {
        await syncToOutlook(data, "update", _customers, _services);
      }

      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments"] }),
  });
};

export const useDeleteAppointment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (appointment: { id: string; outlook_event_id?: string | null; assigned_to?: string | null }) => {
      // Delete from Outlook first
      if (appointment.outlook_event_id && appointment.assigned_to) {
        await syncToOutlook(appointment, "delete");
      }
      const { error } = await supabase.from("appointments").delete().eq("id", appointment.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments"] }),
  });
};
