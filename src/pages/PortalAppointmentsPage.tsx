import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CalendarPlus, Clock, Calendar as CalendarIcon, Send } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { toast } from "sonner";

const PortalAppointmentsPage = () => {
  const { customerId, companyId } = usePortalAuth();
  const queryClient = useQueryClient();
  const [requestOpen, setRequestOpen] = useState(false);
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [description, setDescription] = useState("");

  const { data: myAppointments, isLoading } = useQuery({
    queryKey: ["portal-appointments", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, scheduled_at, duration_minutes, status, notes, services(name)")
        .eq("customer_id", customerId!)
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const requestMutation = useMutation({
    mutationFn: async () => {
      if (!customerId || !companyId) throw new Error("Niet ingelogd");
      // Build a preferred datetime or use a placeholder
      let scheduledAt: string;
      if (preferredDate && preferredTime) {
        scheduledAt = new Date(`${preferredDate}T${preferredTime}`).toISOString();
      } else if (preferredDate) {
        scheduledAt = new Date(`${preferredDate}T09:00`).toISOString();
      } else {
        // No preference given – use tomorrow 09:00 as placeholder
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0);
        scheduledAt = tomorrow.toISOString();
      }

      const { error } = await supabase.from("appointments").insert({
        customer_id: customerId,
        company_id: companyId,
        scheduled_at: scheduledAt,
        duration_minutes: 60,
        status: "aangevraagd",
        notes: [
          description,
          preferredDate ? `Voorkeursdatum: ${preferredDate}` : null,
          preferredTime ? `Voorkeurstijd: ${preferredTime}` : null,
        ].filter(Boolean).join("\n") || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Afspraak aangevraagd! U ontvangt bericht zodra deze is bevestigd.");
      queryClient.invalidateQueries({ queryKey: ["portal-appointments"] });
      setRequestOpen(false);
      setPreferredDate("");
      setPreferredTime("");
      setDescription("");
    },
    onError: () => toast.error("Kon aanvraag niet versturen"),
  });

  const statusColors: Record<string, string> = {
    aangevraagd: "bg-amber-500/10 text-amber-600",
    gepland: "bg-primary/10 text-primary",
    bezig: "bg-primary/10 text-primary",
    afgerond: "bg-accent/10 text-accent",
    geannuleerd: "bg-destructive/10 text-destructive",
  };

  const statusLabels: Record<string, string> = {
    aangevraagd: "Aangevraagd",
    gepland: "Bevestigd",
    bezig: "In behandeling",
    afgerond: "Afgerond",
    geannuleerd: "Geannuleerd",
  };

  if (isLoading) {
    return <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Afspraken</h1>
          <p className="text-sm text-muted-foreground">Bekijk uw afspraken of vraag een nieuwe aan</p>
        </div>
        <Button onClick={() => setRequestOpen(true)} className="gap-2">
          <CalendarPlus className="h-4 w-4" />
          Afspraak aanvragen
        </Button>
      </div>

      {!myAppointments?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CalendarIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">Geen afspraken</p>
            <p className="text-sm">Vraag uw eerste afspraak aan via de knop hierboven.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {myAppointments.map((apt) => (
            <Card key={apt.id}>
              <CardContent className="py-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm">
                      {format(new Date(apt.scheduled_at), "EEEE d MMMM yyyy", { locale: nl })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(apt.scheduled_at), "HH:mm")} – {apt.duration_minutes} min
                      {apt.services && ` · ${(apt.services as any).name}`}
                    </p>
                    {apt.notes && <p className="text-xs text-muted-foreground mt-0.5 truncate">{apt.notes}</p>}
                  </div>
                </div>
                <Badge variant="secondary" className={statusColors[apt.status] ?? ""}>
                  {statusLabels[apt.status] ?? apt.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Request dialog */}
      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Afspraak aanvragen</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Geef uw voorkeur op en wij nemen contact met u op om de afspraak te bevestigen.
            </p>

            <div className="space-y-2">
              <Label>Omschrijving *</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Beschrijf kort wat er gedaan moet worden..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Voorkeursdatum</Label>
                <Input
                  type="date"
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>
              <div className="space-y-2">
                <Label>Voorkeurstijd</Label>
                <Input
                  type="time"
                  value={preferredTime}
                  onChange={(e) => setPreferredTime(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              disabled={!description.trim() || requestMutation.isPending}
              onClick={() => requestMutation.mutate()}
              className="w-full gap-2"
            >
              <Send className="h-4 w-4" />
              {requestMutation.isPending ? "Bezig..." : "Aanvraag versturen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PortalAppointmentsPage;
