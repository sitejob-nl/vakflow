import { useMemo, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIndustryConfig } from "@/hooks/useIndustryConfig";
import { useNavigation } from "@/hooks/useNavigation";
import { useOptimizeRoute } from "@/hooks/useMapbox";
import { useUpdateAppointment } from "@/hooks/useAppointments";
import { useToast } from "@/hooks/use-toast";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { format, startOfDay, endOfDay, isSameDay } from "date-fns";
import { nl } from "date-fns/locale";
import {
  Loader2, MapPin, Clock, CheckCircle2, FileText, Route,
  ChevronRight, Navigation, Calendar, Wrench, Camera, Receipt
} from "lucide-react";
import InvoiceDialog from "@/components/InvoiceDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const statusDot: Record<string, string> = {
  gepland: "bg-muted-foreground",
  bevestigd: "bg-primary",
  onderweg: "bg-warning",
  bezig: "bg-warning animate-pulse",
  afgerond: "bg-accent",
  geannuleerd: "bg-destructive",
};

const woStatusBadge: Record<string, string> = {
  open: "bg-cyan-muted text-cyan",
  bezig: "bg-warning-muted text-warning",
  afgerond: "bg-success-muted text-success",
};

const MonteurDashboardPage = () => {
  const { user, companyId } = useAuth();
  const { labels } = useIndustryConfig();
  const { navigate } = useNavigation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const now = new Date();

  // Fetch today's appointments for this monteur
  const { data: todayAppts, isLoading: loadingAppts } = useQuery({
    queryKey: ["monteur-dashboard-appts", user?.id, companyId],
    enabled: !!user?.id,
    queryFn: async () => {
      let q = supabase
        .from("appointments")
        .select("*, customers(name, address, postal_code, city, lat, lng), services(name, color, price), addresses(street, house_number, city, postal_code)")
        .gte("scheduled_at", startOfDay(now).toISOString())
        .lt("scheduled_at", endOfDay(now).toISOString())
        .eq("assigned_to", user!.id)
        .order("scheduled_at");
      if (companyId) q = q.eq("company_id", companyId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  // Fetch open work orders for this monteur
  const { data: openWOs, isLoading: loadingWOs } = useQuery({
    queryKey: ["monteur-dashboard-wos", user?.id, companyId],
    enabled: !!user?.id,
    queryFn: async () => {
      let q = supabase
        .from("work_orders")
        .select("id, work_order_number, status, created_at, customers(name, city), services(name)")
        .eq("assigned_to", user!.id)
        .neq("status", "afgerond")
        .order("created_at", { ascending: false })
        .limit(10);
      if (companyId) q = q.eq("company_id", companyId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  // Route optimization
  const { result: optimizeResult, loading: optimizeLoading, optimize: runOptimize, reset: resetOptimize } = useOptimizeRoute();
  const updateAppointment = useUpdateAppointment();
  const [optimizeDialogOpen, setOptimizeDialogOpen] = useState(false);
  const [applyingOptimize, setApplyingOptimize] = useState(false);
  const [completingWO, setCompletingWO] = useState<any>(null);
  const [completedWO, setCompletedWO] = useState<any>(null);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const canOptimize = (todayAppts?.length ?? 0) >= 2;

  const handleOptimize = useCallback(async () => {
    const dateStr = format(now, "yyyy-MM-dd");
    const result = await runOptimize({
      date: dateStr,
      assigned_to: user?.id,
      round_trip: true,
    });
    if (result) {
      setOptimizeDialogOpen(true);
    } else {
      toast({ title: "Optimalisatie mislukt", variant: "destructive" });
    }
  }, [user?.id, runOptimize, toast]);

  const handleApplyOptimize = useCallback(async () => {
    if (!optimizeResult || !todayAppts) return;
    setApplyingOptimize(true);
    try {
      const optimizedIds = new Set(optimizeResult.stops.map((s) => s.appointment_id));
      const relevantAppts = todayAppts.filter((a: any) => optimizedIds.has(a.id));
      const earliestTime = relevantAppts.reduce((min, a: any) => {
        const t = new Date(a.scheduled_at).getTime();
        return t < min ? t : min;
      }, Infinity);

      let currentTime = earliestTime;
      for (const stop of optimizeResult.stops) {
        const appt = relevantAppts.find((a: any) => a.id === stop.appointment_id) as any;
        if (!appt) continue;
        currentTime += stop.travel_time_minutes * 60 * 1000;
        await updateAppointment.mutateAsync({
          id: stop.appointment_id,
          scheduled_at: new Date(currentTime).toISOString(),
          travel_time_minutes: stop.travel_time_minutes,
        });
        currentTime += (appt.duration_minutes ?? 60) * 60 * 1000;
      }

      queryClient.invalidateQueries({ queryKey: ["monteur-dashboard-appts"] });
      toast({ title: "Route geoptimaliseerd", description: `${optimizeResult.stops.length} afspraken herschikt` });
      setOptimizeDialogOpen(false);
      resetOptimize();
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    } finally {
      setApplyingOptimize(false);
    }
  }, [optimizeResult, todayAppts, updateAppointment, queryClient, toast, resetOptimize]);

  const handleCompleteWO = async () => {
    if (!completingWO) return;
    try {
      const { error } = await supabase.from("work_orders").update({ status: "afgerond", completed_at: new Date().toISOString() }).eq("id", completingWO.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["monteur-dashboard-wos"] });
      queryClient.invalidateQueries({ queryKey: ["monteur-dashboard-appts"] });
      setCompletedWO(completingWO);
      setCompletingWO(null);
      toast({ title: `${completingWO.work_order_number} afgerond ✓` });
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, woId: string) => {
    const file = e.target.files?.[0];
    if (!file || !companyId) return;
    setUploadingPhoto(true);
    try {
      const path = `${companyId}/${woId}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("work-order-photos").upload(path, file);
      if (error) throw error;
      toast({ title: "Foto geüpload ✓" });
    } catch (err: any) {
      toast({ title: "Upload mislukt", description: err.message, variant: "destructive" });
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Stats
  const completedToday = todayAppts?.filter((a: any) => a.status === "afgerond").length ?? 0;
  const totalToday = todayAppts?.length ?? 0;
  const nextAppt = todayAppts?.find((a: any) => a.status !== "afgerond" && a.status !== "geannuleerd");
  const totalRevenue = todayAppts?.reduce((sum, a: any) => {
    if (a.status !== "geannuleerd" && a.services?.price) return sum + a.services.price;
    return sum;
  }, 0) ?? 0;

  const { containerRef, pullDistance, refreshing } = usePullToRefresh({
    onRefresh: () => queryClient.invalidateQueries() as Promise<unknown>,
  });

  const loading = loadingAppts || loadingWOs;

  return (
    <div ref={containerRef}>
      {(pullDistance > 0 || refreshing) && (
        <div className="flex justify-center py-2 -mt-2 mb-2 transition-all" style={{ opacity: Math.min(pullDistance / 50, 1) }}>
          <Loader2 className={`h-5 w-5 text-primary ${refreshing ? "animate-spin" : ""}`} />
        </div>
      )}

      {/* Header with greeting */}
      <div className="mb-5">
        <h1 className="text-[18px] md:text-[22px] font-extrabold">
          {format(now, "EEEE d MMMM", { locale: nl })}
        </h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          {totalToday} afspraken vandaag · {completedToday} afgerond
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-card border border-border rounded-lg p-3.5 shadow-card">
          <div className="text-[10px] text-t3 font-semibold uppercase tracking-wide mb-1">Afspraken</div>
          <div className="text-[22px] font-extrabold font-mono">{loading ? "…" : totalToday}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-3.5 shadow-card">
          <div className="text-[10px] text-t3 font-semibold uppercase tracking-wide mb-1">Afgerond</div>
          <div className="text-[22px] font-extrabold font-mono text-accent">{loading ? "…" : completedToday}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-3.5 shadow-card">
          <div className="text-[10px] text-t3 font-semibold uppercase tracking-wide mb-1">Omzet</div>
          <div className="text-[22px] font-extrabold font-mono">{loading ? "…" : `€${totalRevenue.toFixed(0)}`}</div>
        </div>
      </div>

      {/* Route optimize button */}
      {canOptimize && (
        <button
          onClick={handleOptimize}
          disabled={optimizeLoading}
          className="w-full mb-5 flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-lg text-[13px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50"
        >
          {optimizeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Route className="h-4 w-4" />}
          Optimaliseer route
        </button>
      )}

      {/* Next appointment highlight */}
      {nextAppt && (
        <div className="bg-primary-muted border border-primary/20 rounded-lg p-4 mb-5">
          <div className="text-[10px] font-bold uppercase tracking-wide text-primary mb-2">Volgende afspraak</div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[10px] bg-primary/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-bold truncate">{(nextAppt as any).customers?.name ?? "Onbekend"}</div>
              <div className="text-[12px] text-muted-foreground">
                {format(new Date((nextAppt as any).scheduled_at), "HH:mm")} · {(nextAppt as any).services?.name ?? ""} · {(nextAppt as any).customers?.city ?? ""}
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </div>
          {(nextAppt as any).customers?.address && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(
                `${(nextAppt as any).addresses?.street ?? (nextAppt as any).customers?.address} ${(nextAppt as any).addresses?.house_number ?? ""} ${(nextAppt as any).addresses?.city ?? (nextAppt as any).customers?.city ?? ""}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center gap-1.5 text-[12px] font-bold text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              <Navigation className="h-3.5 w-3.5" /> Navigeer
            </a>
          )}
        </div>
      )}

      {/* Today's appointments */}
      <div className="bg-card border border-border rounded-lg shadow-card mb-5 overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between border-b border-border">
          <h3 className="text-[14px] font-bold flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Dagplanning
          </h3>
          <button onClick={() => navigate("planning")} className="text-[11px] text-primary font-bold hover:underline">
            Planning →
          </button>
        </div>
        {loadingAppts ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : !todayAppts?.length ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Geen afspraken vandaag</div>
        ) : (
          <div className="divide-y divide-border">
            {todayAppts.map((a: any) => {
              const isCompleted = a.status === "afgerond";
              const address = a.addresses
                ? `${a.addresses.street ?? ""} ${a.addresses.house_number ?? ""}, ${a.addresses.city ?? ""}`.trim()
                : a.customers?.address ?? "";
              return (
                <div
                  key={a.id}
                  className={`px-4 py-3 flex items-center gap-3 transition-colors ${isCompleted ? "opacity-50" : "hover:bg-bg-hover"}`}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className={`w-2.5 h-2.5 rounded-full ${statusDot[a.status] ?? statusDot.gepland}`} />
                    <span className="text-[11px] font-mono text-t3">{format(new Date(a.scheduled_at), "HH:mm")}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[13px] font-bold truncate ${isCompleted ? "line-through" : ""}`}>
                      {a.customers?.name ?? "Onbekend"}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {a.services?.name ?? ""}{address ? ` · ${address}` : ""}
                    </div>
                    {a.travel_time_minutes ? (
                      <div className="text-[10px] text-t3 flex items-center gap-1 mt-0.5">
                        <Navigation className="h-2.5 w-2.5" /> {a.travel_time_minutes} min reistijd
                      </div>
                    ) : null}
                  </div>
                  {!isCompleted && a.customers?.address && (
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 flex items-center justify-center rounded-sm text-muted-foreground hover:text-primary hover:bg-bg-hover transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MapPin className="h-4 w-4" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Open work orders */}
      <div className="bg-card border border-border rounded-lg shadow-card overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between border-b border-border">
          <h3 className="text-[14px] font-bold flex items-center gap-2">
            <Wrench className="h-4 w-4" /> Openstaande {labels.workOrders.toLowerCase()}
          </h3>
          <button onClick={() => navigate("workorders")} className="text-[11px] text-primary font-bold hover:underline">
            Alle →
          </button>
        </div>
        {loadingWOs ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : !openWOs?.length ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Geen openstaande {labels.workOrders.toLowerCase()}</div>
        ) : (
          <div className="divide-y divide-border">
            {openWOs.map((wo: any) => (
              <div
                key={wo.id}
                onClick={() => navigate("woDetail", { workOrderId: wo.id })}
                className="px-4 py-3 flex items-center gap-3 hover:bg-bg-hover transition-colors cursor-pointer"
              >
                <div className="w-8 h-8 rounded-[8px] bg-cyan-muted flex items-center justify-center">
                  <FileText className="h-4 w-4 text-cyan" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold truncate">{wo.customers?.name ?? "Onbekend"}</div>
                  <div className="text-[11px] text-t3">
                    {wo.work_order_number} · {wo.services?.name ?? ""}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setCompletingWO(wo); }}
                  className="px-2.5 py-1 bg-accent text-accent-foreground rounded-sm text-[10px] font-bold hover:bg-accent-hover transition-colors flex-shrink-0"
                >
                  ✓ Afronden
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Route optimization dialog */}
      <AlertDialog open={optimizeDialogOpen} onOpenChange={setOptimizeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Route geoptimaliseerd</AlertDialogTitle>
            <AlertDialogDescription>
              {optimizeResult && (
                <span>
                  Totale afstand: {optimizeResult.summary.total_distance_km} km · Totale reistijd: {optimizeResult.summary.total_travel_minutes} min
                  <br />De volgorde van {optimizeResult.stops.length} afspraken wordt aangepast voor de kortste route.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handleApplyOptimize} disabled={applyingOptimize}>
              {applyingOptimize && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Toepassen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Work order completion dialog */}
      <AlertDialog open={!!completingWO} onOpenChange={(open) => !open && setCompletingWO(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Werkbon afronden</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Weet je zeker dat je deze werkbon wilt afronden?</p>
                {completingWO && (
                  <div className="bg-muted rounded-lg p-3 text-[13px] space-y-1.5">
                    <div><span className="font-bold">Klant:</span> {completingWO.customers?.name ?? "—"}</div>
                    <div><span className="font-bold">Werkbon:</span> {completingWO.work_order_number}</div>
                    <div><span className="font-bold">Dienst:</span> {completingWO.services?.name ?? "—"}</div>
                  </div>
                )}
                {completingWO && (
                  <div>
                    <label className="text-[12px] font-bold text-t3 flex items-center gap-1.5 mb-1">
                      <Camera className="h-3.5 w-3.5" /> Foto toevoegen (optioneel)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => handlePhotoUpload(e, completingWO.id)}
                      className="text-[12px] w-full"
                      disabled={uploadingPhoto}
                    />
                    {uploadingPhoto && <Loader2 className="h-4 w-4 animate-spin mt-1 text-primary" />}
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handleCompleteWO} disabled={uploadingPhoto}>
              <CheckCircle2 className="h-4 w-4 mr-1" /> Afronden
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Completed WO success dialog */}
      <AlertDialog open={!!completedWO} onOpenChange={(open) => !open && setCompletedWO(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>✓ Werkbon afgerond</AlertDialogTitle>
            <AlertDialogDescription>
              {completedWO?.work_order_number} is succesvol afgerond. Wil je direct een factuur aanmaken?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Sluiten</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setInvoiceDialogOpen(true);
              setCompletedWO(null);
            }}>
              <Receipt className="h-4 w-4 mr-1" /> Factuur aanmaken
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <InvoiceDialog
        open={invoiceDialogOpen}
        onOpenChange={setInvoiceDialogOpen}
        prefillCustomerId={completedWO?.customers ? undefined : undefined}
      />
    </div>
  );
};

export default MonteurDashboardPage;
