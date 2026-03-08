import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CalendarPlus, Clock, Calendar as CalendarIcon, CheckCircle2 } from "lucide-react";
import { format, addDays, startOfDay, setHours, setMinutes, isAfter, isBefore, isSameDay } from "date-fns";
import { nl } from "date-fns/locale";
import { toast } from "sonner";

const WORK_HOURS = { start: 8, end: 17 };
const SLOT_DURATION = 60; // minutes

const PortalAppointmentsPage = () => {
  const { customerId, companyId } = usePortalAuth();
  const queryClient = useQueryClient();
  const [bookingOpen, setBookingOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  // Fetch existing appointments for the customer
  const { data: myAppointments, isLoading: loadingMine } = useQuery({
    queryKey: ["portal-appointments", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, scheduled_at, duration_minutes, status, notes, services(name, color)")
        .eq("customer_id", customerId!)
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch all company appointments for the selected date to calculate availability
  const { data: dayAppointments } = useQuery({
    queryKey: ["portal-day-appointments", companyId, selectedDate?.toISOString()],
    enabled: !!companyId && !!selectedDate,
    queryFn: async () => {
      const dayStart = startOfDay(selectedDate!).toISOString();
      const dayEnd = startOfDay(addDays(selectedDate!, 1)).toISOString();
      const { data, error } = await supabase
        .from("appointments")
        .select("scheduled_at, duration_minutes")
        .gte("scheduled_at", dayStart)
        .lt("scheduled_at", dayEnd)
        .neq("status", "geannuleerd");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Generate available slots for selected date
  const availableSlots = useMemo(() => {
    if (!selectedDate) return [];
    const slots: string[] = [];
    const now = new Date();
    const booked = (dayAppointments ?? []).map((a) => ({
      start: new Date(a.scheduled_at),
      end: new Date(new Date(a.scheduled_at).getTime() + a.duration_minutes * 60000),
    }));

    for (let h = WORK_HOURS.start; h < WORK_HOURS.end; h++) {
      const slotStart = setMinutes(setHours(startOfDay(selectedDate), h), 0);
      const slotEnd = new Date(slotStart.getTime() + SLOT_DURATION * 60000);

      // Skip past slots
      if (isBefore(slotStart, now)) continue;

      // Check overlap with existing appointments
      const hasConflict = booked.some(
        (b) => isBefore(slotStart, b.end) && isAfter(slotEnd, b.start)
      );
      if (!hasConflict) {
        slots.push(slotStart.toISOString());
      }
    }
    return slots;
  }, [selectedDate, dayAppointments]);

  const bookMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSlot || !customerId || !companyId) throw new Error("Geen slot geselecteerd");
      const { error } = await supabase.from("appointments").insert({
        customer_id: customerId,
        company_id: companyId,
        scheduled_at: selectedSlot,
        duration_minutes: SLOT_DURATION,
        status: "gepland",
        notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Afspraak ingepland!");
      queryClient.invalidateQueries({ queryKey: ["portal-appointments"] });
      setBookingOpen(false);
      setSelectedDate(undefined);
      setSelectedSlot(null);
      setNotes("");
    },
    onError: () => toast.error("Kon afspraak niet inplannen"),
  });

  const statusColors: Record<string, string> = {
    gepland: "bg-primary/10 text-primary",
    bezig: "bg-purple-500/10 text-purple-600",
    afgerond: "bg-accent/10 text-accent",
    geannuleerd: "bg-destructive/10 text-destructive",
  };

  if (loadingMine) {
    return <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Afspraken</h1>
          <p className="text-sm text-muted-foreground">Bekijk en plan afspraken in</p>
        </div>
        <Button onClick={() => setBookingOpen(true)} className="gap-2">
          <CalendarPlus className="h-4 w-4" />
          Nieuwe afspraak
        </Button>
      </div>

      {/* Existing appointments */}
      {!myAppointments?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CalendarIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">Geen afspraken</p>
            <p className="text-sm">Plan uw eerste afspraak in via de knop hierboven.</p>
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
                  {apt.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Booking dialog */}
      <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Afspraak inplannen</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Step 1: pick date */}
            <div>
              <p className="text-sm font-medium mb-2">Kies een datum</p>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => { setSelectedDate(d); setSelectedSlot(null); }}
                disabled={(date) => date < startOfDay(new Date()) || date > addDays(new Date(), 60) || date.getDay() === 0}
                locale={nl}
                className="rounded-md border mx-auto"
              />
            </div>

            {/* Step 2: pick time slot */}
            {selectedDate && (
              <div>
                <p className="text-sm font-medium mb-2">
                  Beschikbare tijden op {format(selectedDate, "d MMMM", { locale: nl })}
                </p>
                {availableSlots.length === 0 ? (
                  <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                    Geen beschikbare slots op deze dag. Kies een andere datum.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {availableSlots.map((slot) => (
                      <Button
                        key={slot}
                        variant={selectedSlot === slot ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedSlot(slot)}
                        className="text-sm"
                      >
                        {format(new Date(slot), "HH:mm")}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: optional notes */}
            {selectedSlot && (
              <div>
                <p className="text-sm font-medium mb-2">Opmerkingen (optioneel)</p>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Omschrijf kort wat er gedaan moet worden..."
                  rows={3}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              disabled={!selectedSlot || bookMutation.isPending}
              onClick={() => bookMutation.mutate()}
              className="w-full gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              {bookMutation.isPending ? "Bezig..." : "Afspraak bevestigen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PortalAppointmentsPage;
