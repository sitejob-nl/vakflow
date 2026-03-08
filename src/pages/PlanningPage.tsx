import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAppointments, useUpdateAppointment, useDeleteAppointment, type Appointment } from "@/hooks/useAppointments";
import { useCreateWorkOrder, useWorkOrders } from "@/hooks/useWorkOrders";
import { useServices } from "@/hooks/useCustomers";
import { useOutlookCalendar, type OutlookEvent } from "@/hooks/useOutlookCalendar";
import OutlookEventSheet from "@/components/OutlookEventSheet";
import { useOutlookOverrides } from "@/hooks/useOutlookOverrides";
import { usePersonalOutlookToken } from "@/hooks/useOutlookOverrides";
import { useAuth } from "@/contexts/AuthContext";
import { buildWorkOrderPayload } from "@/utils/createWorkOrderFromAppointment";
import { Loader2, Plus, Trash2, CheckCircle2, Navigation, ExternalLink, FileText, ChevronLeft, ChevronRight, Users, Calendar as CalendarIcon, Route } from "lucide-react";
import { format, startOfWeek, addDays, addWeeks, subWeeks, isToday, isSameDay, subDays, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { nl } from "date-fns/locale";
import AppointmentDialog from "@/components/AppointmentDialog";
import AppointmentDetailSheet from "@/components/AppointmentDetailSheet";
import CurrentTimeIndicator from "@/components/planning/CurrentTimeIndicator";
import MonthView from "@/components/planning/MonthView";
import RouteMap from "@/components/planning/RouteMap";
import { useNavigation } from "@/hooks/useNavigation";
import { useToast } from "@/hooks/use-toast";
import { useDirections, useOptimizeRoute, type OptimizedStop } from "@/hooks/useMapbox";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Quarter-hour slots from 6:00 to 21:45
const slots = Array.from({ length: 64 }, (_, i) => ({
  hour: Math.floor((i + 24) / 4),
  minute: ((i + 24) % 4) * 15,
  label: `${Math.floor((i + 24) / 4).toString().padStart(2, "0")}:${(((i + 24) % 4) * 15).toString().padStart(2, "0")}`,
})).filter((s) => s.hour >= 6 && s.hour <= 21);

const SLOT_HEIGHT = 28;
const defaultEventColor = "#3b82f6";

const statusDot: Record<string, string> = {
  afgerond: "bg-accent",
  bezig: "bg-primary animate-pulse-dot",
  onderweg: "bg-warning",
  gepland: "bg-border",
  geannuleerd: "bg-destructive",
};

const TravelTimeBadge = ({ from, to }: { from: [number, number]; to: [number, number] }) => {
  const { result, loading, calculate } = useDirections();
  useEffect(() => {
    calculate(from, to);
  }, [from[0], from[1], to[0], to[1], calculate]);
  if (loading) return null;
  if (!result?.duration_minutes) return null;
  return (
    <div className="flex items-center gap-1.5 py-1 px-1 text-[11px] text-muted-foreground">
      <Navigation className="h-3 w-3" />
      <span>{result.duration_minutes} min · {result.distance_km} km</span>
    </div>
  );
};

const PlanningPage = () => {
  const { toast } = useToast();
  const { navigate } = useNavigation();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  // Mobile: selected day for day view
  const [mobileDay, setMobileDay] = useState(() => new Date());

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editAppointment, setEditAppointment] = useState<Appointment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Appointment | null>(null);
  const [defaultDate, setDefaultDate] = useState<Date | undefined>();
  const [detailAppointment, setDetailAppointment] = useState<Appointment | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [outlookDetailEvent, setOutlookDetailEvent] = useState<OutlookEvent | null>(null);
  const [outlookDetailOpen, setOutlookDetailOpen] = useState(false);
  // View mode: week or month
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [currentMonth, setCurrentMonth] = useState(() => new Date());

  // Drag & drop state
  const [dragAppointmentId, setDragAppointmentId] = useState<string | null>(null);
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);

  // Selected day for desktop (route optimization target)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Employee filter — monteurs zien alleen hun eigen afspraken
  const { user, role } = useAuth();
  const isMonteur = role === "monteur";
  const [filterEmployee, setFilterEmployee] = useState<string>("all");
  const { data: teamMembers } = useTeamMembers();

  // Auto-set filter voor monteurs
  useEffect(() => {
    if (isMonteur && user?.id) {
      setFilterEmployee(user.id);
    }
  }, [isMonteur, user?.id]);

  // Outlook calendar integration
  const [showOutlook, setShowOutlook] = useState(true); // default ON
  const { companyId } = useAuth();
  const { data: personalOutlookToken } = usePersonalOutlookToken();
  const { data: outlookOverrides } = useOutlookOverrides();
  const outlookConnected = !!personalOutlookToken;

  // For mobile, fetch a wider range around mobileDay
  const weekEnd = addDays(currentWeekStart, 8);
  const mobileStart = isMobile ? startOfWeek(mobileDay, { weekStartsOn: 1 }) : currentWeekStart;
  const mobileEnd = isMobile ? addDays(mobileStart, 8) : weekEnd;

  // Month view date range
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = addDays(endOfMonth(currentMonth), 1);

  const fetchStart = viewMode === "month" && !isMobile ? monthStart : (isMobile ? mobileStart : currentWeekStart);
  const fetchEnd = viewMode === "month" && !isMobile ? monthEnd : (isMobile ? mobileEnd : weekEnd);

  const { data: rawAppointments, isLoading } = useAppointments(fetchStart, fetchEnd);
  const { data: outlookEvents } = useOutlookCalendar(fetchStart, fetchEnd, showOutlook && outlookConnected, "all");

  // Filter appointments by employee
  const appointments = useMemo(() => {
    if (!rawAppointments) return rawAppointments;
    if (filterEmployee === "all") return rawAppointments;
    return rawAppointments.filter((a) => a.assigned_to === filterEmployee);
  }, [rawAppointments, filterEmployee]);

  // Convert Outlook events to renderable items for the calendar grid
  const getOutlookEventsForHour = (day: Date, hour: number) => {
    if (!outlookEvents || !showOutlook) return [];
    return outlookEvents.filter((ev) => {
      const d = new Date(ev.start.dateTime + (ev.start.timeZone === "UTC" ? "Z" : ""));
      return isSameDay(d, day) && d.getHours() === hour;
    });
  };

  const deleteAppointment = useDeleteAppointment();
  const updateAppointment = useUpdateAppointment();
  const createWorkOrder = useCreateWorkOrder();
  const { data: allWorkOrders } = useWorkOrders();
  const { data: services } = useServices();

  // Route optimization
  const { result: optimizeResult, loading: optimizeLoading, error: optimizeError, optimize: runOptimize, reset: resetOptimize } = useOptimizeRoute();
  const [optimizeDialogOpen, setOptimizeDialogOpen] = useState(false);
  const [applyingOptimize, setApplyingOptimize] = useState(false);

  // Determine if optimize button should show (≥2 appointments on selected day with coords)
  const optimizeTargetDate = isMobile ? mobileDay : (selectedDay ?? null);
  const optimizeTargetAssignedTo = filterEmployee !== "all" ? filterEmployee : undefined;

  const canOptimize = useMemo(() => {
    if (!optimizeTargetDate || !appointments) return false;
    const dayAppts = appointments.filter((a) =>
      isSameDay(new Date(a.scheduled_at), optimizeTargetDate) &&
      a.status !== "geannuleerd" &&
      (filterEmployee === "all" || a.assigned_to === filterEmployee)
    );
    return dayAppts.length >= 2;
  }, [appointments, optimizeTargetDate, filterEmployee]);

  const handleOptimize = useCallback(async () => {
    if (!optimizeTargetDate) return;
    const dateStr = format(optimizeTargetDate, "yyyy-MM-dd");
    const result = await runOptimize({
      date: dateStr,
      assigned_to: optimizeTargetAssignedTo,
      round_trip: true,
    });
    if (result) {
      setOptimizeDialogOpen(true);
    } else {
      toast({ title: "Optimalisatie mislukt", description: optimizeError ?? "Onbekende fout", variant: "destructive" });
    }
  }, [optimizeTargetDate, optimizeTargetAssignedTo, runOptimize, optimizeError, toast]);

  const handleApplyOptimize = useCallback(async () => {
    if (!optimizeResult || !appointments) return;
    setApplyingOptimize(true);
    try {
      // Find the earliest scheduled_at among the optimized appointments
      const optimizedIds = new Set(optimizeResult.stops.map((s) => s.appointment_id));
      const relevantAppts = appointments.filter((a) => optimizedIds.has(a.id));
      const earliestTime = relevantAppts.reduce((min, a) => {
        const t = new Date(a.scheduled_at).getTime();
        return t < min ? t : min;
      }, Infinity);

      let currentTime = earliestTime;

      for (const stop of optimizeResult.stops) {
        const appt = relevantAppts.find((a) => a.id === stop.appointment_id);
        if (!appt) continue;

        // Add travel time before this appointment
        currentTime += stop.travel_time_minutes * 60 * 1000;

        const newScheduledAt = new Date(currentTime).toISOString();
        await updateAppointment.mutateAsync({
          id: stop.appointment_id,
          scheduled_at: newScheduledAt,
          travel_time_minutes: stop.travel_time_minutes,
        });

        // Next appointment starts after this one's duration
        currentTime += (appt.duration_minutes ?? 60) * 60 * 1000;
      }

      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast({ title: "Route geoptimaliseerd", description: `${optimizeResult.stops.length} afspraken herschikt` });
      setOptimizeDialogOpen(false);
      resetOptimize();
    } catch (err: any) {
      toast({ title: "Fout bij toepassen", description: err.message, variant: "destructive" });
    } finally {
      setApplyingOptimize(false);
    }
  }, [optimizeResult, appointments, updateAppointment, queryClient, toast, resetOptimize]);

  const appointmentWoMap = useMemo(() => {
    const map = new Map<string, string>();
    allWorkOrders?.forEach((wo) => {
      if (wo.appointment_id) map.set(wo.appointment_id, wo.id);
    });
    return map;
  }, [allWorkOrders]);

  const [showWeekend, setShowWeekend] = useState(false);
  const dayCount = showWeekend ? 7 : 5;
  const days = Array.from({ length: dayCount }, (_, i) => addDays(currentWeekStart, i));

  // Appointments for the selected mobile day
  const mobileDayAppointments = useMemo(() => {
    return (appointments ?? [])
      .filter((a) => isSameDay(new Date(a.scheduled_at), mobileDay))
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  }, [appointments, mobileDay]);

  const todayAppointments = useMemo(() => {
    const today = new Date();
    return (appointments ?? [])
      .filter((a) => isSameDay(new Date(a.scheduled_at), today))
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  }, [appointments]);

  const dailyRevenue = useMemo(() => {
    const source = isMobile ? mobileDayAppointments : todayAppointments;
    const serviceCount: Record<string, { count: number; price: number; name: string }> = {};
    source.forEach((a) => {
      if (a.services && a.status !== "geannuleerd") {
        const key = a.services.name;
        if (!serviceCount[key]) serviceCount[key] = { count: 0, price: a.services.price, name: key };
        serviceCount[key].count++;
      }
    });
    return Object.values(serviceCount);
  }, [isMobile, mobileDayAppointments, todayAppointments]);

  const totalRevenue = dailyRevenue.reduce((sum, s) => sum + s.count * s.price, 0);

  const handleCellClick = (day: Date, hour: number, minute: number) => {
    const d = new Date(day);
    d.setHours(hour, minute, 0, 0);
    setDefaultDate(d);
    setEditAppointment(null);
    setDialogOpen(true);
  };

  const handleEventClick = (e: React.MouseEvent, appointment: Appointment) => {
    e.stopPropagation();
    setDetailAppointment(appointment);
    setDetailOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteAppointment.mutateAsync({ id: deleteTarget.id, outlook_event_id: deleteTarget.outlook_event_id, assigned_to: deleteTarget.assigned_to });
      toast({ title: "Afspraak verwijderd" });
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
    setDeleteTarget(null);
  };

  const handleFinish = async (a: Appointment) => {
    try {
      const payload = buildWorkOrderPayload(a, services);
      const wo = await createWorkOrder.mutateAsync(payload as any);
      await updateAppointment.mutateAsync({ id: a.id, status: "afgerond" });
      toast({ title: "Werkbon aangemaakt", description: wo.work_order_number ?? "Werkbon is klaar" });
      navigate("woDetail", { workOrderId: wo.id });
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  const getEventsForHour = (day: Date, hour: number) => {
    return (appointments ?? []).filter((a) => {
      const d = new Date(a.scheduled_at);
      return isSameDay(d, day) && d.getHours() === hour;
    });
  };

  const weekLabel = `${format(currentWeekStart, "d", { locale: nl })} – ${format(addDays(currentWeekStart, dayCount - 1), "d MMM yyyy", { locale: nl })}`;

  // Side panel content (shared between mobile and desktop)
  const sideAppointments = isMobile ? mobileDayAppointments : todayAppointments;
  const sideDateLabel = isMobile
    ? format(mobileDay, "d MMM", { locale: nl })
    : format(new Date(), "d MMM", { locale: nl });
  const sideTitlePrefix = isMobile
    ? (isToday(mobileDay) ? "Vandaag" : format(mobileDay, "EEEE", { locale: nl }))
    : "Vandaag";

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-[1fr_310px] gap-5 lg:h-[calc(100vh-58px-48px)]">
      {/* Calendar */}
      <div className="bg-card border border-border rounded-xl shadow-sm flex flex-col overflow-hidden min-h-[400px] md:min-h-[500px] lg:min-h-0">
        {/* Toolbar */}
        {isMobile ? (
          /* Mobile toolbar: day navigation */
          <div className="px-3 py-3 flex items-center gap-2 border-b border-border flex-wrap">
            <button onClick={() => setMobileDay((d) => subDays(d, 1))} className="w-8 h-8 flex items-center justify-center rounded-sm text-t3 hover:bg-bg-hover transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => setMobileDay((d) => addDays(d, 1))} className="w-8 h-8 flex items-center justify-center rounded-sm text-t3 hover:bg-bg-hover transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="text-[14px] font-extrabold flex-1">
              {isToday(mobileDay) ? "Vandaag" : format(mobileDay, "EEEE", { locale: nl })}
              <span className="text-t3 font-semibold ml-1.5 text-[12px]">{format(mobileDay, "d MMM", { locale: nl })}</span>
            </span>
            {!isToday(mobileDay) && (
              <button onClick={() => setMobileDay(new Date())} className="px-2.5 py-1 bg-card border border-border rounded-sm text-[11px] font-bold text-secondary-foreground hover:bg-bg-hover transition-colors">
                Vandaag
              </button>
            )}
            {outlookConnected && (
              <label className="flex items-center gap-1 text-[11px] font-bold text-secondary-foreground cursor-pointer">
                <Switch checked={showOutlook} onCheckedChange={setShowOutlook} className="scale-[0.65]" />
                <CalendarIcon className="h-3 w-3" />
              </label>
            )}
            {canOptimize && (
              <button
                onClick={handleOptimize}
                disabled={optimizeLoading}
                className="w-8 h-8 flex items-center justify-center rounded-sm text-t3 hover:bg-bg-hover transition-colors disabled:opacity-50"
                title="Optimaliseer route"
              >
                {optimizeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Route className="h-4 w-4" />}
              </button>
            )}
          </div>
        ) : (
          /* Desktop toolbar */
          <div className="px-3 md:px-5 py-3 md:py-3.5 flex items-center gap-2 md:gap-3 border-b border-border flex-wrap">
            {/* Navigation group */}
            <div className="flex items-center gap-1">
              {viewMode === "week" ? (
                <>
                  <button onClick={() => setCurrentWeekStart((w) => subWeeks(w, 1))} className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button onClick={() => setCurrentWeekStart((w) => addWeeks(w, 1))} className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setCurrentMonth((m) => subMonths(m, 1))} className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button onClick={() => setCurrentMonth((m) => addMonths(m, 1))} className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
            <span className="text-base font-extrabold min-w-[170px]">
              {viewMode === "week" ? weekLabel : format(currentMonth, "MMMM yyyy", { locale: nl })}
            </span>
            {appointments && <span className="text-muted-foreground text-[12px] font-semibold">{appointments.length} afspraken</span>}

            {/* Separator */}
            <div className="w-px h-5 bg-border hidden md:block" />

            <button onClick={() => { setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 })); setCurrentMonth(new Date()); }} className="px-3 py-1.5 bg-card border border-border rounded-lg text-[12px] font-bold text-secondary-foreground hover:bg-muted transition-colors">Vandaag</button>
            {viewMode === "week" && (
              <button onClick={() => setShowWeekend((v) => !v)} className="px-3 py-1.5 bg-card border border-border rounded-lg text-[12px] font-bold text-secondary-foreground hover:bg-muted transition-colors">
                {showWeekend ? "Ma–Vr" : "Ma–Zo"}
              </button>
            )}
            <button
              onClick={() => setViewMode(viewMode === "week" ? "month" : "week")}
              className="px-3 py-1.5 bg-card border border-border rounded-lg text-[12px] font-bold text-secondary-foreground hover:bg-muted transition-colors flex items-center gap-1.5"
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              {viewMode === "week" ? "Maand" : "Week"}
            </button>
            {!isMonteur && teamMembers && teamMembers.length > 1 && (
              <Select value={filterEmployee} onValueChange={setFilterEmployee}>
                <SelectTrigger className="w-[160px] h-9 text-[12px] rounded-lg">
                  <Users className="h-3.5 w-3.5 mr-1 flex-shrink-0" />
                  <SelectValue placeholder="Alle medewerkers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle medewerkers</SelectItem>
                  {teamMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name ?? "Onbekend"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {outlookConnected && (
              <label className="flex items-center gap-1.5 text-[12px] font-bold text-secondary-foreground cursor-pointer">
                <Switch checked={showOutlook} onCheckedChange={setShowOutlook} className="scale-75" />
                Outlook
              </label>
            )}
            <div className="flex-1" />
            {canOptimize && optimizeTargetDate && (
              <button
                onClick={handleOptimize}
                disabled={optimizeLoading}
                className="px-3 py-1.5 bg-card border border-border rounded-lg text-[12px] font-bold text-secondary-foreground hover:bg-muted transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {optimizeLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Route className="h-3.5 w-3.5" />}
                Route {format(optimizeTargetDate, "EEEE d MMM", { locale: nl })}
              </button>
            )}
            <button
              onClick={() => { setEditAppointment(null); setDefaultDate(undefined); setDialogOpen(true); }}
              className="h-9 px-4 bg-primary text-primary-foreground rounded-lg text-[13px] font-bold hover:bg-primary-hover transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="h-4 w-4" /> Nieuwe afspraak
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : isMobile ? (
            /* ===== MOBILE DAY VIEW ===== */
            <div className="relative grid grid-cols-[50px_1fr]">
              {/* Time indicator for mobile - spans the right column */}
              {isToday(mobileDay) && (
                <div className="absolute left-[50px] right-0 top-0 bottom-0 pointer-events-none">
                  <CurrentTimeIndicator startHour={6} endHour={22} slotHeight={SLOT_HEIGHT} />
                </div>
              )}
              {slots.map((slot) => {
                const cellEvents = slot.minute === 0 ? getEventsForHour(mobileDay, slot.hour) : [];
                return (
                  <div key={slot.label} className="contents">
                    <div className={`pr-2 text-right text-[10px] text-t3 font-mono flex items-start justify-end border-r border-border pt-0.5 ${slot.minute === 0 ? "border-b border-b-border/60" : "border-b border-b-border/20"}`} style={{ height: `${SLOT_HEIGHT}px` }}>
                      {slot.minute === 0 ? slot.label : ""}
                    </div>
                    <div
                      className={`relative hover:bg-bg-hover transition-colors cursor-pointer ${slot.minute === 0 ? "border-b border-b-border/60" : "border-b border-b-border/20"}`}
                      style={{ height: `${SLOT_HEIGHT}px` }}
                      onClick={() => handleCellClick(mobileDay, slot.hour, slot.minute)}
                    >
                      {cellEvents.map((ev) => {
                        const hexColor = ev.services?.color || defaultEventColor;
                        const startDate = new Date(ev.scheduled_at);
                        const startMinuteOffset = startDate.getMinutes();
                        const durationSlots = (ev.duration_minutes ?? 60) / 15;
                        const topOffset = (startMinuteOffset / 15) * SLOT_HEIGHT;
                        const eventHeight = Math.max(durationSlots * SLOT_HEIGHT - 2, SLOT_HEIGHT - 2);
                        const travelMin = (ev as any).travel_time_minutes;
                        const travelBlockPx = travelMin ? Math.max(Math.round((travelMin / 15) * SLOT_HEIGHT), 14) : 0;
                        const hasWorkOrder = appointmentWoMap.has(ev.id);
                        return (
                          <div key={ev.id} className="absolute left-[2px] right-[2px] z-[2]" style={{ top: `${topOffset}px` }} onClick={(e) => handleEventClick(e, ev)}>
                            {travelMin > 0 && (
                              <div
                                className="flex items-center gap-1 text-[8px] text-muted-foreground bg-muted/60 rounded-t-md px-1 border border-border/40 border-b-0"
                                style={{ height: `${travelBlockPx}px`, marginTop: `-${travelBlockPx}px` }}
                              >
                                <Navigation className="h-2.5 w-2.5 flex-shrink-0" />
                                <span className="truncate">{travelMin} min</span>
                              </div>
                            )}
                            <div
                              className="rounded-lg px-2.5 py-1 text-[13px] font-bold cursor-pointer overflow-hidden transition-all relative border-l-[3px]"
                              style={{
                                height: `${eventHeight}px`,
                                backgroundColor: `${hexColor}18`,
                                color: hexColor,
                                borderLeftColor: hexColor,
                                boxShadow: `0 1px 3px ${hexColor}15`,
                              }}
                            >
                              <div className="flex items-center gap-1.5">
                                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDot[ev.status] ?? "bg-border"}`} />
                                <span className="text-[11px] font-medium opacity-70 font-mono">
                                  {format(startDate, "HH:mm")}
                                </span>
                                <span className="truncate font-extrabold">{ev.customers?.name ?? "Onbekend"}</span>
                                {hasWorkOrder && <FileText className="h-3 w-3 opacity-50 flex-shrink-0" />}
                              </div>
                              {eventHeight > SLOT_HEIGHT && (
                                <div className="text-[11px] opacity-60 truncate mt-0.5">
                                  {ev.services?.name} · {ev.customers?.city}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {/* Outlook events on mobile */}
                      {slot.minute === 0 && getOutlookEventsForHour(mobileDay, slot.hour).map((oev) => {
                        const isPersonal = oev._source === "personal";
                        const outlookColor = isPersonal ? "#2563eb" : "#7c3aed";
                        const startDate = new Date(oev.start.dateTime + (oev.start.timeZone === "UTC" ? "Z" : ""));
                        const endDate = new Date(oev.end.dateTime + (oev.end.timeZone === "UTC" ? "Z" : ""));
                        const startMinuteOffset = startDate.getMinutes();
                        const durationMin = Math.max((endDate.getTime() - startDate.getTime()) / 60000, 15);
                        const durationSlots = durationMin / 15;
                        const topOffset = (startMinuteOffset / 15) * SLOT_HEIGHT;
                        const eventHeight = Math.max(durationSlots * SLOT_HEIGHT - 2, SLOT_HEIGHT - 2);
                        const isPinned = outlookOverrides?.some((o) => o.outlook_event_id === oev.id && o.pinned);
                        return (
                          <div key={`outlook-${oev.id}`} className="absolute left-[2px] right-[2px] z-[1] cursor-pointer" style={{ top: `${topOffset}px` }} onClick={(e) => { e.stopPropagation(); setOutlookDetailEvent(oev); setOutlookDetailOpen(true); }}>
                            <div
                              className="rounded-md px-1.5 py-[2px] text-[10px] font-bold overflow-hidden opacity-80 border-l-[3px] hover:opacity-100 transition-opacity"
                              style={{
                                height: `${eventHeight}px`,
                                backgroundColor: `${outlookColor}20`,
                                color: outlookColor,
                                borderLeftColor: outlookColor,
                              }}
                            >
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] font-medium opacity-70 font-mono">
                                  {format(startDate, "HH:mm")}
                                </span>
                                {isPinned && <span className="text-[8px]">📌</span>}
                                <CalendarIcon className="h-2.5 w-2.5 opacity-60 flex-shrink-0" />
                                <span className="truncate">{oev.subject || "Outlook"}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : viewMode === "month" ? (
            /* ===== DESKTOP MONTH VIEW ===== */
            <MonthView
              currentMonth={currentMonth}
              appointments={appointments ?? []}
              onDayClick={(day) => {
                setCurrentWeekStart(startOfWeek(day, { weekStartsOn: 1 }));
                setViewMode("week");
              }}
            />
          ) : (
            /* ===== DESKTOP WEEK VIEW ===== */
            <div className={`relative grid ${showWeekend ? "grid-cols-[58px_repeat(7,1fr)]" : "grid-cols-[58px_repeat(5,1fr)]"}`}>
              <div className="sticky top-0 bg-card z-10 p-2.5 border-b border-border" />
              {days.map((d) => {
                const isSelected = selectedDay && isSameDay(d, selectedDay);
                const isTodayCol = isToday(d);
                return (
                  <div
                    key={d.toISOString()}
                    className={`sticky top-0 z-10 py-2.5 px-1 text-center border-b border-border cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-primary-muted ring-2 ring-primary/30 ring-inset"
                        : isTodayCol
                          ? "bg-primary-muted"
                          : "bg-card hover:bg-muted/50"
                    }`}
                    onClick={() => setSelectedDay((prev) => prev && isSameDay(prev, d) ? null : d)}
                    title="Klik om dag te selecteren voor route optimalisatie"
                  >
                    <div className={`text-[11px] font-semibold uppercase tracking-wide ${isTodayCol || isSelected ? "text-primary" : "text-muted-foreground"}`}>
                      {format(d, "EEE", { locale: nl })}
                    </div>
                    <div className="flex items-center justify-center mt-0.5">
                      <span className={`inline-flex items-center justify-center text-[15px] font-extrabold ${
                        isTodayCol
                          ? "w-8 h-8 rounded-full bg-primary text-primary-foreground"
                          : isSelected
                            ? "text-primary"
                            : "text-foreground"
                      }`}>
                        {format(d, "d")}
                      </span>
                    </div>
                  </div>
                );
              })}
              {slots.map((slot) => (
                <div key={slot.label} className="contents">
                  <div className={`pr-2.5 text-right text-[10px] text-t3 font-mono flex items-start justify-end border-r border-border pt-0.5 ${slot.minute === 0 ? "border-b border-b-border/60" : "border-b border-b-border/20"}`} style={{ height: `${SLOT_HEIGHT}px` }}>
                    {slot.minute === 0 ? slot.label : ""}
                  </div>
                  {days.map((day) => {
                    const cellEvents = slot.minute === 0 ? getEventsForHour(day, slot.hour) : [];
                    return (
                      <div
                        key={day.toISOString() + slot.label}
                        className={`border-r border-r-border/40 relative hover:bg-bg-hover transition-colors cursor-pointer ${slot.minute === 0 ? "border-b border-b-border/60" : "border-b border-b-border/20"}`}
                        style={{ height: `${SLOT_HEIGHT}px` }}
                        onClick={() => handleCellClick(day, slot.hour, slot.minute)}
                      >
                        {/* Current time indicator for today column */}
                        {slot.hour === 6 && slot.minute === 0 && isToday(day) && (
                          <CurrentTimeIndicator startHour={6} endHour={22} slotHeight={SLOT_HEIGHT} />
                        )}
                        {cellEvents.map((ev) => {
                          const hexColor = ev.services?.color || defaultEventColor;
                          const startDate = new Date(ev.scheduled_at);
                          const startMinuteOffset = startDate.getMinutes();
                          const durationSlots = (ev.duration_minutes ?? 60) / 15;
                          const topOffset = (startMinuteOffset / 15) * SLOT_HEIGHT;
                          const eventHeight = Math.max(durationSlots * SLOT_HEIGHT - 2, SLOT_HEIGHT - 2);
                          const travelMin = (ev as any).travel_time_minutes;
                          const travelBlockPx = travelMin ? Math.max(Math.round((travelMin / 15) * SLOT_HEIGHT), 14) : 0;
                          const hasWorkOrder = appointmentWoMap.has(ev.id);
                          return (
                            <div key={ev.id} className="absolute left-[2px] right-[2px] z-[2]" style={{ top: `${topOffset}px` }} onClick={(e) => handleEventClick(e, ev)}>
                              {travelMin > 0 && (
                                <div
                                  className="flex items-center gap-1 text-[8px] text-muted-foreground bg-muted/60 rounded-t-md px-1 border border-border/40 border-b-0"
                                  style={{ height: `${travelBlockPx}px`, marginTop: `-${travelBlockPx}px` }}
                                >
                                  <Navigation className="h-2.5 w-2.5 flex-shrink-0" />
                                  <span className="truncate">{travelMin} min</span>
                                </div>
                              )}
                              <div
                                className="rounded-lg px-2 py-1 text-[11px] font-bold cursor-pointer overflow-hidden hover:scale-[1.02] hover:z-[5] transition-all relative border-l-[3px]"
                                style={{
                                  height: `${eventHeight}px`,
                                  backgroundColor: `${hexColor}18`,
                                  color: hexColor,
                                  borderLeftColor: hexColor,
                                  boxShadow: `0 1px 3px ${hexColor}15`,
                                }}
                              >
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDot[ev.status] ?? "bg-border"}`} />
                                  <span className="text-[10px] font-medium opacity-70 font-mono">
                                    {format(new Date(ev.scheduled_at), "HH:mm")}
                                  </span>
                                  <span className="truncate font-extrabold">{ev.customers?.name ?? "Onbekend"}</span>
                                  {hasWorkOrder && <FileText className="h-3 w-3 opacity-50 flex-shrink-0" />}
                                </div>
                                {eventHeight > SLOT_HEIGHT * 1.5 && (
                                  <div className="text-[10px] opacity-60 truncate mt-0.5">
                                    {ev.services?.name}{ev.customers?.city ? ` · ${ev.customers.city}` : ""}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {/* Outlook events */}
                        {slot.minute === 0 && getOutlookEventsForHour(day, slot.hour).map((oev) => {
                          const isPersonal = oev._source === "personal";
                          const outlookColor = isPersonal ? "#2563eb" : "#7c3aed";
                          const startDate = new Date(oev.start.dateTime + (oev.start.timeZone === "UTC" ? "Z" : ""));
                          const endDate = new Date(oev.end.dateTime + (oev.end.timeZone === "UTC" ? "Z" : ""));
                          const startMinuteOffset = startDate.getMinutes();
                          const durationMin = Math.max((endDate.getTime() - startDate.getTime()) / 60000, 15);
                          const durationSlots = durationMin / 15;
                          const topOffset = (startMinuteOffset / 15) * SLOT_HEIGHT;
                          const eventHeight = Math.max(durationSlots * SLOT_HEIGHT - 2, SLOT_HEIGHT - 2);
                          const isPinned = outlookOverrides?.some((o) => o.outlook_event_id === oev.id && o.pinned);
                          return (
                            <div key={`outlook-${oev.id}`} className="absolute left-[2px] right-[2px] z-[1] cursor-pointer" style={{ top: `${topOffset}px` }} onClick={(e) => { e.stopPropagation(); setOutlookDetailEvent(oev); setOutlookDetailOpen(true); }}>
                              <div
                                className="rounded-md px-1.5 py-[2px] text-[10px] font-bold overflow-hidden opacity-80 border-l-[3px] hover:opacity-100 transition-opacity"
                                style={{
                                  height: `${eventHeight}px`,
                                  backgroundColor: `${outlookColor}20`,
                                  color: outlookColor,
                                  borderLeftColor: outlookColor,
                                }}
                              >
                                <div className="flex items-center gap-1">
                                  <span className="text-[9px] font-medium opacity-70 font-mono">
                                    {format(startDate, "HH:mm")}
                                  </span>
                                  {isPinned && <span className="text-[8px]">📌</span>}
                                  <CalendarIcon className="h-2.5 w-2.5 opacity-60 flex-shrink-0" />
                                  <span className="truncate">{oev.subject || "Outlook"}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Side panels */}
      <div className="flex flex-col gap-4 overflow-y-auto">
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-4 border-b border-border flex items-center justify-between">
            <h3 className="text-[15px] font-extrabold">{sideTitlePrefix} — {sideDateLabel}</h3>
            <span className="text-muted-foreground text-[12px] font-semibold">{sideAppointments.length} afspraken</span>
          </div>
          <div className="px-4 py-3">
            {sideAppointments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Geen afspraken {isMobile && !isToday(mobileDay) ? "deze dag" : "vandaag"}</p>
            ) : (
              sideAppointments.map((a, idx) => {
                const storedTravel = (a as any).travel_time_minutes;
                const prev = idx > 0 ? sideAppointments[idx - 1] : null;
                const prevLat = prev ? (prev.customers as any)?.lat : null;
                const prevLng = prev ? (prev.customers as any)?.lng : null;
                const curLat = (a.customers as any)?.lat;
                const curLng = (a.customers as any)?.lng;
                const canShowLiveTravel = !storedTravel && prevLat && prevLng && curLat && curLng;
                return (
                  <div key={a.id}>
                    {storedTravel && (() => {
                      // Show previous customer's address as "from" label when available
                      const fromLabel = prev
                        ? [(prev.customers as any)?.name, (prev.customers as any)?.city].filter(Boolean).join(" — ")
                        : (a as any).start_location_label;
                      return (
                        <div className="flex items-center gap-1.5 py-1 px-1 text-[11px] text-muted-foreground">
                          <Navigation className="h-3 w-3" />
                          <span>{storedTravel} min</span>
                          {fromLabel && (
                            <span className="text-muted-foreground/60">vanaf {fromLabel}</span>
                          )}
                        </div>
                      );
                    })()}
                    {canShowLiveTravel && (
                      <TravelTimeBadge from={[prevLat, prevLng]} to={[curLat, curLng]} />
                    )}
                    <div
                      className="flex items-start gap-3 py-3 border-b border-border/60 last:border-b-0 cursor-pointer hover:bg-muted/50 rounded-lg px-2 -mx-2 transition-colors"
                      onClick={() => { setDetailAppointment(a); setDetailOpen(true); }}
                    >
                      <div className={`w-2.5 h-2.5 rounded-full mt-[5px] flex-shrink-0 ${statusDot[a.status] ?? "bg-border"}`} />
                      <div className="font-mono text-[12px] text-muted-foreground min-w-[44px] pt-px font-semibold">
                        {format(new Date(a.scheduled_at), "HH:mm")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-extrabold truncate flex items-center gap-1.5">
                          {a.customers?.name ?? "Onbekend"}
                          {appointmentWoMap.has(a.id) && <FileText className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
                        </div>
                        <div className="text-[12px] text-muted-foreground truncate mt-0.5">
                          {a.services?.name ?? ""} · {a.customers?.city ?? ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {a.customers?.address && a.customers?.city && (
                          <a
                            href={`https://www.google.com/maps/place/${`${a.customers.address}, ${a.customers.postal_code || ""} ${a.customers.city}`.replace(/ /g, "+")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-t3 hover:text-primary transition-colors p-1"
                            title="Routebeschrijving"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {a.status !== "afgerond" && a.status !== "geannuleerd" && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleFinish(a); }}
                            className="text-t3 hover:text-accent transition-colors p-1"
                            title="Afronden → werkbon aanmaken"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(a); }}
                          className="text-t3 hover:text-destructive transition-colors p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-4 border-b border-border">
            <h3 className="text-[15px] font-extrabold">Diensten {isMobile && !isToday(mobileDay) ? format(mobileDay, "EEEE", { locale: nl }) : "vandaag"}</h3>
          </div>
          <div className="px-4 py-3 text-[13px]">
            {dailyRevenue.length === 0 ? (
              <p className="text-muted-foreground text-center py-2">Geen diensten</p>
            ) : (
              dailyRevenue.map((d) => (
                <div key={d.name} className="flex justify-between py-1.5 border-b border-border">
                  <span>{d.name}</span><strong>{d.count}x · €{(d.count * d.price).toFixed(2)}</strong>
                </div>
              ))
            )}
            {totalRevenue > 0 && (
              <div className="flex justify-between pt-2 font-extrabold text-primary">
                <span>Dagomzet (incl.)</span><strong>€{totalRevenue.toFixed(2)}</strong>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile FAB */}
      {isMobile && (
        <button
          onClick={() => { setEditAppointment(null); setDefaultDate(undefined); setDialogOpen(true); }}
          className="fixed bottom-20 right-4 z-30 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary-hover transition-colors safe-bottom"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      <AppointmentDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        appointment={detailAppointment}
        onEdit={(a) => { setEditAppointment(a); setDialogOpen(true); }}
        onDelete={(a) => setDeleteTarget(a)}
        onFinish={(a) => handleFinish(a)}
        onDuplicate={(a) => {
          const tomorrow = new Date(a.scheduled_at);
          tomorrow.setDate(tomorrow.getDate() + 1);
          setDefaultDate(tomorrow);
          // Set as template: pass as edit but we'll clear the id
          setEditAppointment({ ...a, id: "__duplicate__" as any } as Appointment);
          setDialogOpen(true);
        }}
        linkedWorkOrderId={detailAppointment ? appointmentWoMap.get(detailAppointment.id) ?? null : null}
      />

      <AppointmentDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditAppointment(null); }}
        appointment={editAppointment}
        defaultDate={defaultDate}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Afspraak verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze afspraak wilt verwijderen?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Route optimization confirmation dialog */}
      <AlertDialog open={optimizeDialogOpen} onOpenChange={(open) => { if (!open) { setOptimizeDialogOpen(false); resetOptimize(); } }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Route className="h-5 w-5 text-primary" />
              Route optimaliseren
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {optimizeResult && (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Voorgestelde volgorde voor {optimizeResult.stops.length} stops
                      {optimizeResult.summary.skipped_count > 0 && (
                        <span className="text-warning"> ({optimizeResult.summary.skipped_count} overgeslagen, geen coördinaten)</span>
                      )}
                    </p>
                    {optimizeResult.company_origin && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                        <Navigation className="h-3 w-3" />
                        <span>Start: {optimizeResult.company_origin}</span>
                      </div>
                    )}
                    <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                      {optimizeResult.stops.map((stop, idx) => (
                        <div key={stop.appointment_id} className="flex items-center gap-2 text-sm py-1.5 px-2 bg-muted/50 rounded-md">
                          <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                            {idx + 1}
                          </span>
                          <span className="flex-1 truncate font-medium">{stop.label}</span>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {stop.travel_time_minutes} min · {stop.distance_km} km
                          </span>
                        </div>
                      ))}
                    </div>
                    <RouteMap stops={optimizeResult.stops} companyOrigin={optimizeResult.company_origin} />
                    <div className="flex justify-between text-sm font-bold pt-2 border-t border-border">
                      <span>Totaal rijtijd</span>
                      <span>{optimizeResult.summary.total_travel_minutes} min · {optimizeResult.summary.total_distance_km} km</span>
                    </div>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handleApplyOptimize} disabled={applyingOptimize}>
              {applyingOptimize ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Toepassen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PlanningPage;
