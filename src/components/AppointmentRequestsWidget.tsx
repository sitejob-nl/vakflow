import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { CalendarClock, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

const AppointmentRequestsWidget = () => {
  const { companyId } = useAuth();
  const queryClient = useQueryClient();

  const { data: requests, isLoading } = useQuery({
    queryKey: ["appointment-requests", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, scheduled_at, notes, created_at, customers(name, phone, email)")
        .eq("company_id", companyId!)
        .eq("status", "aangevraagd")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("appointments")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      toast.success(status === "gepland" ? "Afspraak bevestigd" : "Afspraak geannuleerd");
      queryClient.invalidateQueries({ queryKey: ["appointment-requests"] });
      queryClient.invalidateQueries({ queryKey: ["today-appointments"] });
    },
    onError: () => toast.error("Kon status niet wijzigen"),
  });

  if (!requests?.length && !isLoading) return null;

  return (
    <div className="bg-card border border-border rounded-lg shadow-card overflow-hidden">
      <div className="px-4 md:px-5 py-3 md:py-4 flex items-center justify-between border-b border-border">
        <h3 className="text-[14px] md:text-[15px] font-bold flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-warning" />
          Afspraakaanvragen
        </h3>
        <span className="inline-flex px-2.5 py-[3px] rounded-full text-[11px] font-bold bg-warning-muted text-warning">
          {requests?.length ?? 0}
        </span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="divide-y divide-border">
          {requests?.map((req) => (
            <div key={req.id} className="px-4 md:px-5 py-3 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-bold truncate">
                    {(req.customers as any)?.name ?? "Onbekende klant"}
                  </p>
                  <p className="text-[11px] text-t3">
                    Voorkeur: {format(new Date(req.scheduled_at), "EEEE d MMMM · HH:mm", { locale: nl })}
                  </p>
                  {req.notes && (
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{req.notes}</p>
                  )}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => updateStatus.mutate({ id: req.id, status: "gepland" })}
                    disabled={updateStatus.isPending}
                    className="p-1.5 rounded-md bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50 transition-colors"
                    title="Bevestigen"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => updateStatus.mutate({ id: req.id, status: "geannuleerd" })}
                    disabled={updateStatus.isPending}
                    className="p-1.5 rounded-md bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 transition-colors"
                    title="Afwijzen"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AppointmentRequestsWidget;
