import { useNavigation } from "@/hooks/useNavigation";
import { useTodayAppointments, useDashboardStats, useReminders, useRecentWorkOrders, useWeekWorkOrders, useOpenQuotes, useRecentActivity } from "@/hooks/useDashboard";
import TodoWidget from "@/components/TodoWidget";
import MaintenancePlannerWidget from "@/components/MaintenancePlannerWidget";
import OnboardingChecklist from "@/components/OnboardingChecklist";
import { format, differenceInDays, startOfDay } from "date-fns";
import { nl } from "date-fns/locale";
import { Loader2, CalendarPlus, FileText, Receipt, Car, AlertTriangle, Wrench, Building2, Truck, Sparkles, ClipboardCheck, Phone, PhoneMissed, Users, Globe, TrendingUp, Clock, Package, Bot } from "lucide-react";
import { useAiConversations } from "@/hooks/useAiConversations";
import { useState } from "react";
import AppointmentDialog from "@/components/AppointmentDialog";
import WorkOrderDialog from "@/components/WorkOrderDialog";
import InvoiceDialog from "@/components/InvoiceDialog";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import AppointmentRequestsWidget from "@/components/AppointmentRequestsWidget";
import ServiceRequestsWidget from "@/components/ServiceRequestsWidget";
import { useQueryClient } from "@tanstack/react-query";
import { useIndustryConfig } from "@/hooks/useIndustryConfig";
import { useAuth } from "@/contexts/AuthContext";
import { useAutomotiveDashboardStats } from "@/hooks/useAutomotiveDashboard";
import { useCleaningDashboardStats } from "@/hooks/useCleaningDashboard";
import { useAutomotiveSalesDashboard } from "@/hooks/useAutomotiveSalesDashboard";
import { useLiveCalls } from "@/hooks/useLiveCalls";
import { useClickToDial } from "@/hooks/useClickToDial";

const Badge = ({ children, variant = "primary" }: { children: React.ReactNode; variant?: string }) => {
  const styles: Record<string, string> = {
    primary: "bg-primary-muted text-primary",
    accent: "bg-accent-muted text-accent",
    success: "bg-success-muted text-success",
    warning: "bg-warning-muted text-warning",
    destructive: "bg-destructive-muted text-destructive",
    purple: "bg-purple-muted text-purple",
    cyan: "bg-cyan-muted text-cyan",
  };
  return (
    <span className={`inline-flex px-2.5 py-[3px] rounded-full text-[11px] font-bold ${styles[variant] || styles.primary}`}>
      {children}
    </span>
  );
};

const statusVariant: Record<string, string> = {
  gepland: "cyan",
  bevestigd: "primary",
  onderweg: "warning",
  bezig: "warning",
  afgerond: "success",
  geannuleerd: "destructive",
};

const woStatusVariant: Record<string, string> = {
  open: "cyan",
  bezig: "warning",
  afgerond: "success",
};

const serviceColorMap: Record<string, string> = {
  "MV-reiniging": "primary",
  "MV-box vervangen": "accent",
  "WTW onderhoud": "purple",
  "WTW-unit vervangen": "cyan",
};

const formatCurrency = (amount: number) => {
  if (amount >= 1000) return `€${(amount / 1000).toFixed(1)}k`;
  return `€${amount.toFixed(0)}`;
};

const DashboardPage = () => {
  const { navigate } = useNavigation();
  const queryClient = useQueryClient();
  const { labels, industry } = useIndustryConfig();
  const { enabledFeatures } = useAuth();
  const isAutomotive = industry === "automotive";
  const showSalesWidgets = isAutomotive || enabledFeatures.includes("vehicle_sales");
  const isCleaning = industry === "cleaning";
  const { data: todayAppts, isLoading: loadingAppts } = useTodayAppointments();
  const { data: stats, isLoading: loadingStats } = useDashboardStats();
  const { data: reminders, isLoading: loadingReminders } = useReminders();
  const { data: recentWOs } = useRecentWorkOrders();
  const { data: weekWOs } = useWeekWorkOrders();
  const { data: openQuotes } = useOpenQuotes();
  const { data: recentActivity } = useRecentActivity();
  const { data: autoStats } = useAutomotiveDashboardStats();
  const { data: cleaningStats } = useCleaningDashboardStats();
  const { data: salesStats } = useAutomotiveSalesDashboard();

  const [apptDialogOpen, setApptDialogOpen] = useState(false);
  const [woDialogOpen, setWoDialogOpen] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [quickDialNumber, setQuickDialNumber] = useState("");

  const hasVoip = enabledFeatures.includes("voip");
  const { activeCalls, ringingCalls, answeredCalls } = useLiveCalls();
  const clickToDial = useClickToDial();

  const { containerRef, pullDistance, refreshing } = usePullToRefresh({
    onRefresh: () => queryClient.invalidateQueries() as Promise<unknown>,
  });

  const loading = loadingAppts || loadingStats;

  const kpiCards = [
    { label: "Openstaand", value: stats ? formatCurrency(stats.outstandingAmount) : "—", sub: stats ? `${stats.outstandingCount} facturen` : undefined, page: "invoices" as const },
    { label: `Omzet ${format(new Date(), "MMM", { locale: nl })}`, value: stats ? formatCurrency(stats.revenueMonth) : "—", page: "invoices" as const },
    { label: `${labels.workOrders} deze week`, value: weekWOs ?? "—", page: "workorders" as const },
    { label: "Open offertes", value: openQuotes ?? "—", page: "quotes" as const },
  ];

  return (
    <div ref={containerRef}>
      {/* Pull to refresh indicator */}
      {(pullDistance > 0 || refreshing) && (
        <div className="flex justify-center py-2 -mt-2 mb-2 transition-all" style={{ opacity: Math.min(pullDistance / 50, 1) }}>
          <Loader2 className={`h-5 w-5 text-primary ${refreshing ? "animate-spin" : ""}`} />
        </div>
      )}

      {/* Onboarding checklist */}
      <OnboardingChecklist />
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4 mb-5 md:mb-6">
        {kpiCards.map((s) => (
          <div
            key={s.label}
            onClick={() => navigate(s.page)}
            className="bg-card border border-border rounded-lg p-3.5 md:p-5 shadow-card cursor-pointer hover:border-primary hover:shadow-card-hover transition-all"
          >
            <div className="text-[10px] md:text-[11.5px] text-t3 font-semibold uppercase tracking-wide mb-1">{s.label}</div>
            <div className="text-[22px] md:text-[28px] font-extrabold font-mono tracking-tighter">{loading ? "…" : s.value}</div>
            {s.sub && <div className="text-[10px] md:text-[11.5px] mt-1 font-semibold text-t3">{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Automotive KPIs */}
      {isAutomotive && autoStats && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4 mb-5 md:mb-6">
          <div onClick={() => navigate("vehicles")} className="bg-card border border-border rounded-lg p-3.5 md:p-5 shadow-card cursor-pointer hover:border-primary hover:shadow-card-hover transition-all">
            <div className="text-[10px] md:text-[11.5px] text-t3 font-semibold uppercase tracking-wide mb-1 flex items-center gap-1">
              <Car className="h-3 w-3" /> Voertuigen
            </div>
            <div className="text-[22px] md:text-[28px] font-extrabold font-mono tracking-tighter">{autoStats.totalVehicles}</div>
            <div className="text-[10px] md:text-[11.5px] mt-1 font-semibold text-t3">actief</div>
          </div>
          <div onClick={() => navigate("planning")} className="bg-card border border-border rounded-lg p-3.5 md:p-5 shadow-card cursor-pointer hover:border-primary hover:shadow-card-hover transition-all">
            <div className="text-[10px] md:text-[11.5px] text-t3 font-semibold uppercase tracking-wide mb-1 flex items-center gap-1">
              <Wrench className="h-3 w-3" /> Brugbezetting
            </div>
            <div className="text-[22px] md:text-[28px] font-extrabold font-mono tracking-tighter">{autoStats.occupancyPercent}%</div>
            <div className="text-[10px] md:text-[11.5px] mt-1 font-semibold text-t3">{autoStats.occupiedBays}/{autoStats.totalBays} bruggen</div>
          </div>
          <div onClick={() => navigate("vehicles")} className={`bg-card border rounded-lg p-3.5 md:p-5 shadow-card cursor-pointer hover:shadow-card-hover transition-all ${autoStats.apkExpiringThisMonth.length > 0 ? "border-warning hover:border-warning" : "border-border hover:border-primary"}`}>
            <div className="text-[10px] md:text-[11.5px] text-t3 font-semibold uppercase tracking-wide mb-1 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> APK verloopt
            </div>
            <div className="text-[22px] md:text-[28px] font-extrabold font-mono tracking-tighter">{autoStats.apkExpiringThisMonth.length}</div>
            <div className="text-[10px] md:text-[11.5px] mt-1 font-semibold text-t3">deze maand</div>
          </div>
          <div onClick={() => navigate("workorders")} className="bg-card border border-border rounded-lg p-3.5 md:p-5 shadow-card cursor-pointer hover:border-primary hover:shadow-card-hover transition-all">
            <div className="text-[10px] md:text-[11.5px] text-t3 font-semibold uppercase tracking-wide mb-1">Open werkorders</div>
            <div className="text-[22px] md:text-[28px] font-extrabold font-mono tracking-tighter">{stats?.openWorkOrders ?? "—"}</div>
          </div>
        </div>
      )}

      {/* Automotive Sales & Communication KPIs */}
      {showSalesWidgets && salesStats && (
        <>
          {/* Verkoop rij */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4 mb-5 md:mb-6">
            <div onClick={() => navigate("trade")} className="bg-card border border-border rounded-lg p-3.5 md:p-5 shadow-card cursor-pointer hover:border-primary hover:shadow-card-hover transition-all">
              <div className="text-[10px] md:text-[11.5px] text-t3 font-semibold uppercase tracking-wide mb-1 flex items-center gap-1">
                <Package className="h-3 w-3" /> Voorraad
              </div>
              <div className="text-[22px] md:text-[28px] font-extrabold font-mono tracking-tighter">{salesStats.stockCount}</div>
              <div className="text-[10px] md:text-[11.5px] mt-1 font-semibold text-t3">{salesStats.onlineCount} online</div>
            </div>
            <div onClick={() => navigate("trade")} className="bg-card border border-border rounded-lg p-3.5 md:p-5 shadow-card cursor-pointer hover:border-primary hover:shadow-card-hover transition-all">
              <div className="text-[10px] md:text-[11.5px] text-t3 font-semibold uppercase tracking-wide mb-1 flex items-center gap-1">
                <Car className="h-3 w-3" /> Verkocht deze maand
              </div>
              <div className="text-[22px] md:text-[28px] font-extrabold font-mono tracking-tighter">{salesStats.soldCount}</div>
            </div>
            <div className="bg-card border border-border rounded-lg p-3.5 md:p-5 shadow-card">
              <div className="text-[10px] md:text-[11.5px] text-t3 font-semibold uppercase tracking-wide mb-1 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Gem. marge
              </div>
              <div className="text-[22px] md:text-[28px] font-extrabold font-mono tracking-tighter">
                {salesStats.avgMargin >= 1000 ? `€${(salesStats.avgMargin / 1000).toFixed(1)}k` : `€${Math.round(salesStats.avgMargin)}`}
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-3.5 md:p-5 shadow-card">
              <div className="text-[10px] md:text-[11.5px] text-t3 font-semibold uppercase tracking-wide mb-1 flex items-center gap-1">
                <Clock className="h-3 w-3" /> Gem. doorlooptijd
              </div>
              <div className="text-[22px] md:text-[28px] font-extrabold font-mono tracking-tighter">{salesStats.avgLeadTime}</div>
              <div className="text-[10px] md:text-[11.5px] mt-1 font-semibold text-t3">dagen</div>
            </div>
          </div>

          {/* Communicatie rij */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4 mb-5 md:mb-6">
            {/* Live gesprekken kaart */}
            {hasVoip && (
              <div onClick={() => navigate("calltracking")} className="bg-card border border-border rounded-lg p-3.5 md:p-5 shadow-card cursor-pointer hover:border-primary hover:shadow-card-hover transition-all">
                {activeCalls > 0 && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className={`h-2 w-2 rounded-full ${ringingCalls > 0 ? "bg-destructive" : "bg-emerald-500"} animate-pulse`} />
                    <span className="text-[11px] font-bold text-emerald-600">{activeCalls} actief</span>
                  </div>
                )}
                <div className="text-[10px] md:text-[11.5px] text-t3 font-semibold uppercase tracking-wide mb-1 flex items-center gap-1">
                  <Phone className="h-3 w-3" /> Gesprekken vandaag
                </div>
                <div className="text-[22px] md:text-[28px] font-extrabold font-mono tracking-tighter">{salesStats.callsToday}</div>
                <div className="flex gap-3 mt-1">
                  <span className="text-[10px] md:text-[11.5px] font-semibold text-t3">{salesStats.callsToday - salesStats.missedToday} beantwoord</span>
                  {salesStats.missedToday > 0 && (
                    <span className="text-[10px] md:text-[11.5px] font-semibold text-destructive">{salesStats.missedToday} gemist</span>
                  )}
                </div>
              </div>
            )}
            {!hasVoip && (
              <div onClick={() => navigate("calltracking")} className="bg-card border border-border rounded-lg p-3.5 md:p-5 shadow-card cursor-pointer hover:border-primary hover:shadow-card-hover transition-all">
                <div className="text-[10px] md:text-[11.5px] text-t3 font-semibold uppercase tracking-wide mb-1 flex items-center gap-1">
                  <Phone className="h-3 w-3" /> Gesprekken vandaag
                </div>
                <div className="text-[22px] md:text-[28px] font-extrabold font-mono tracking-tighter">{salesStats.callsToday}</div>
                {salesStats.missedToday > 0 && (
                  <div className="text-[10px] md:text-[11.5px] mt-1 font-semibold text-destructive">{salesStats.missedToday} gemist</div>
                )}
              </div>
            )}

            {/* Laatste gemiste */}
            {hasVoip && (
              <div onClick={() => navigate("calltracking")} className="bg-card border border-border rounded-lg p-3.5 md:p-5 shadow-card cursor-pointer hover:border-primary hover:shadow-card-hover transition-all">
                <div className="text-[10px] md:text-[11.5px] text-t3 font-semibold uppercase tracking-wide mb-2 flex items-center gap-1">
                  <PhoneMissed className="h-3 w-3" /> Laatste gemiste
                </div>
                {salesStats.recentMissed.length > 0 ? (
                  <div className="space-y-1.5">
                    {salesStats.recentMissed.slice(0, 3).map((call) => (
                      <div key={call.id} className="flex items-center justify-between gap-2">
                        <span className="text-[12px] font-semibold truncate">{call.customers?.name ?? call.from_number ?? "Onbekend"}</span>
                        <span className="text-[10px] text-t3 font-mono flex-shrink-0">
                          {call.started_at ? format(new Date(call.started_at), "HH:mm") : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12px] text-muted-foreground">Geen gemiste oproepen vandaag</p>
                )}
              </div>
            )}

            <div onClick={() => navigate("leads")} className="bg-card border border-border rounded-lg p-3.5 md:p-5 shadow-card cursor-pointer hover:border-primary hover:shadow-card-hover transition-all">
              <div className="text-[10px] md:text-[11.5px] text-t3 font-semibold uppercase tracking-wide mb-1 flex items-center gap-1">
                <Users className="h-3 w-3" /> Openstaande leads
              </div>
              <div className="text-[22px] md:text-[28px] font-extrabold font-mono tracking-tighter">{salesStats.openLeads}</div>
            </div>
            <div onClick={() => navigate("leads")} className="bg-card border border-border rounded-lg p-3.5 md:p-5 shadow-card cursor-pointer hover:border-primary hover:shadow-card-hover transition-all">
              <div className="text-[10px] md:text-[11.5px] text-t3 font-semibold uppercase tracking-wide mb-1 flex items-center gap-1">
                <Globe className="h-3 w-3" /> Portaalleads deze week
              </div>
              <div className="text-[22px] md:text-[28px] font-extrabold font-mono tracking-tighter">{salesStats.portalLeadsCount}</div>
            </div>
          </div>

          {/* Klik-en-bel quick action */}
          {hasVoip && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 mb-5 md:mb-6">
              <div className="bg-card border border-border rounded-lg p-3.5 md:p-5 shadow-card">
                <div className="text-[10px] md:text-[11.5px] text-t3 font-semibold uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Phone className="h-3 w-3" /> Klik-en-bel
                </div>
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (quickDialNumber.trim()) {
                      clickToDial.mutate({ phone_number: quickDialNumber.trim() });
                      setQuickDialNumber("");
                    }
                  }}
                >
                  <input
                    type="tel"
                    value={quickDialNumber}
                    onChange={(e) => setQuickDialNumber(e.target.value)}
                    placeholder="Bel een nummer..."
                    className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <button
                    type="submit"
                    disabled={!quickDialNumber.trim() || clickToDial.isPending}
                    className="inline-flex items-center justify-center h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {clickToDial.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Hexon Status + Recente gemiste oproepen */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 mb-5 md:mb-6">
            {/* Hexon Status */}
            {Object.keys(salesStats.hexonByPortal).length > 0 && (
              <div className="bg-card border border-border rounded-lg shadow-card overflow-hidden">
                <div className="px-4 md:px-5 py-3 md:py-4 flex items-center justify-between border-b border-border">
                  <h3 className="text-[14px] md:text-[15px] font-bold">Hexon Status</h3>
                  {salesStats.totalHexonErrors > 0 && (
                    <span className="inline-flex px-2.5 py-[3px] rounded-full text-[11px] font-bold bg-destructive-muted text-destructive">
                      {salesStats.totalHexonErrors} errors
                    </span>
                  )}
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="bg-background">
                      {["Portaal", "Online", "Pending", "Error"].map(h => (
                        <th key={h} className="text-left px-4 md:px-5 py-2 text-[10.5px] font-bold uppercase tracking-wider text-t3 border-b border-border">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(salesStats.hexonByPortal).map(([code, counts]) => (
                      <tr key={code} className="border-b border-border last:border-0">
                        <td className="px-4 md:px-5 py-2.5 text-[13px] font-bold capitalize">{code.replace(/_/g, " ")}</td>
                        <td className="px-4 md:px-5 py-2.5 text-[13px] font-mono">{counts.online}</td>
                        <td className="px-4 md:px-5 py-2.5 text-[13px] font-mono">{counts.pending}</td>
                        <td className="px-4 md:px-5 py-2.5 text-[13px] font-mono">
                          {counts.error > 0 ? (
                            <span className="text-destructive font-bold">{counts.error}</span>
                          ) : counts.error}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Recente gemiste oproepen */}
            {salesStats.recentMissed.length > 0 && (
              <div className="bg-card border border-border rounded-lg shadow-card overflow-hidden">
                <div className="px-4 md:px-5 py-3 md:py-4 flex items-center justify-between border-b border-border">
                  <h3 className="text-[14px] md:text-[15px] font-bold flex items-center gap-1.5">
                    <PhoneMissed className="h-4 w-4 text-destructive" /> Gemiste oproepen
                  </h3>
                  <button onClick={() => navigate("calltracking")} className="text-[11px] text-primary font-bold hover:underline">Alle →</button>
                </div>
                <div className="divide-y divide-border">
                  {salesStats.recentMissed.map((call) => (
                    <div
                      key={call.id}
                      onClick={() => navigate("calltracking")}
                      className="px-4 md:px-5 py-2.5 flex items-center gap-3 hover:bg-bg-hover transition-colors cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-full bg-destructive-muted flex items-center justify-center flex-shrink-0">
                        <PhoneMissed className="h-3.5 w-3.5 text-destructive" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-bold truncate">{call.customers?.name ?? call.from_number ?? "Onbekend"}</div>
                        {call.customers?.name && call.from_number && (
                          <div className="text-[11px] text-t3 font-mono">{call.from_number}</div>
                        )}
                      </div>
                      <div className="text-[10px] text-t3 font-mono flex-shrink-0">
                        {call.started_at ? format(new Date(call.started_at), "HH:mm") : "—"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {isCleaning && cleaningStats && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4 mb-5 md:mb-6">
          <div onClick={() => navigate("assets")} className="bg-card border border-border rounded-lg p-3.5 md:p-5 shadow-card cursor-pointer hover:border-primary hover:shadow-card-hover transition-all">
            <div className="text-[10px] md:text-[11.5px] text-t3 font-semibold uppercase tracking-wide mb-1 flex items-center gap-1">
              <Building2 className="h-3 w-3" /> Actieve objecten
            </div>
            <div className="text-[22px] md:text-[28px] font-extrabold font-mono tracking-tighter">{cleaningStats.activeObjects}</div>
          </div>
          <div onClick={() => navigate("schedule")} className={`bg-card border rounded-lg p-3.5 md:p-5 shadow-card cursor-pointer hover:shadow-card-hover transition-all ${cleaningStats.overdueObjects > 0 ? "border-destructive hover:border-destructive" : "border-border hover:border-primary"}`}>
            <div className="text-[10px] md:text-[11.5px] text-t3 font-semibold uppercase tracking-wide mb-1 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Achterstallig
            </div>
            <div className={`text-[22px] md:text-[28px] font-extrabold font-mono tracking-tighter ${cleaningStats.overdueObjects > 0 ? "text-destructive" : ""}`}>{cleaningStats.overdueObjects}</div>
          </div>
          <div onClick={() => navigate("workorders")} className="bg-card border border-border rounded-lg p-3.5 md:p-5 shadow-card cursor-pointer hover:border-primary hover:shadow-card-hover transition-all">
            <div className="text-[10px] md:text-[11.5px] text-t3 font-semibold uppercase tracking-wide mb-1">{labels.workOrders} vandaag</div>
            <div className="text-[22px] md:text-[28px] font-extrabold font-mono tracking-tighter">{cleaningStats.todayWorkOrders}</div>
          </div>
          {cleaningStats.vehiclesWashedThisMonth > 0 && (
            <div className="bg-card border border-border rounded-lg p-3.5 md:p-5 shadow-card">
              <div className="text-[10px] md:text-[11.5px] text-t3 font-semibold uppercase tracking-wide mb-1 flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Voertuigen gewassen
              </div>
              <div className="text-[22px] md:text-[28px] font-extrabold font-mono tracking-tighter">{cleaningStats.vehiclesWashedThisMonth}</div>
              <div className="text-[10px] md:text-[11.5px] mt-1 font-semibold text-t3">deze maand</div>
            </div>
          )}
          {cleaningStats.avgQualityScore !== null && (
            <div onClick={() => navigate("audits")} className="bg-card border border-border rounded-lg p-3.5 md:p-5 shadow-card cursor-pointer hover:border-primary hover:shadow-card-hover transition-all">
              <div className="text-[10px] md:text-[11.5px] text-t3 font-semibold uppercase tracking-wide mb-1 flex items-center gap-1">
                <ClipboardCheck className="h-3 w-3" /> Gem. kwaliteit
              </div>
              <div className={`text-[22px] md:text-[28px] font-extrabold font-mono tracking-tighter ${cleaningStats.avgQualityScore >= 4 ? "text-green-600 dark:text-green-400" : cleaningStats.avgQualityScore >= 3 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"}`}>
                {cleaningStats.avgQualityScore.toFixed(1)}
              </div>
              <div className="text-[10px] md:text-[11.5px] mt-1 font-semibold text-t3">/ 5.0</div>
            </div>
          )}
        </div>
      )}

      {/* Cleaning: urgent objects widget */}
      {isCleaning && cleaningStats && cleaningStats.urgentObjects.length > 0 && (
        <div className="bg-card border border-border rounded-lg shadow-card mb-5 overflow-hidden">
          <div className="px-4 md:px-5 py-3 md:py-4 flex items-center justify-between border-b border-border">
            <h3 className="text-[14px] md:text-[15px] font-bold">Te plannen objecten</h3>
            <button onClick={() => navigate("schedule")} className="text-[11px] text-primary font-bold hover:underline">Alle →</button>
          </div>
          <div className="divide-y divide-border">
            {cleaningStats.urgentObjects.map((obj) => {
              const days = differenceInDays(new Date(obj.next_service_due), new Date());
              const isOverdue = days < 0;
              return (
                <div key={obj.id} className="px-4 md:px-5 py-2.5 flex items-center gap-3">
                  {obj.object_type === "fleet" ? <Truck className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold truncate">{obj.name}</div>
                    <div className="text-[11px] text-t3">{obj.customer_name || "—"}</div>
                  </div>
                  <span className={`inline-flex px-2.5 py-[3px] rounded-full text-[11px] font-bold ${isOverdue ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"}`}>
                    {isOverdue ? `${Math.abs(days)}d te laat` : days === 0 ? "Vandaag" : `Over ${days}d`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <AppointmentRequestsWidget />
      <ServiceRequestsWidget />


      <div className="flex gap-2 mb-5 flex-wrap">
        <button onClick={() => setApptDialogOpen(true)} className="flex items-center gap-1.5 px-3.5 py-2 bg-card border border-border rounded-lg text-[12px] font-bold text-secondary-foreground hover:border-primary hover:text-primary transition-all shadow-card">
          <CalendarPlus className="h-3.5 w-3.5" /> Nieuwe afspraak
        </button>
        <button onClick={() => setWoDialogOpen(true)} className="flex items-center gap-1.5 px-3.5 py-2 bg-card border border-border rounded-lg text-[12px] font-bold text-secondary-foreground hover:border-primary hover:text-primary transition-all shadow-card">
          <FileText className="h-3.5 w-3.5" /> Nieuwe {labels.workOrder.toLowerCase()}
        </button>
        <button onClick={() => setInvoiceDialogOpen(true)} className="flex items-center gap-1.5 px-3.5 py-2 bg-card border border-border rounded-lg text-[12px] font-bold text-secondary-foreground hover:border-primary hover:text-primary transition-all shadow-card">
          <Receipt className="h-3.5 w-3.5" /> Nieuwe factuur
        </button>
      </div>

      {/* Recente activiteit */}
      {recentActivity && recentActivity.length > 0 && (
        <div className="bg-card border border-border rounded-lg shadow-card mb-5 overflow-hidden">
          <div className="px-4 md:px-5 py-3 md:py-4 flex items-center justify-between border-b border-border">
            <h3 className="text-[14px] md:text-[15px] font-bold">Recente activiteit</h3>
            <button onClick={() => navigate("communication")} className="text-[11px] text-primary font-bold hover:underline">Alle →</button>
          </div>
          <div className="divide-y divide-border">
            {recentActivity.map((log: any) => (
              <div key={log.id} className="px-4 md:px-5 py-2.5 flex items-center gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] ${log.channel === "email" ? "bg-primary-muted text-primary" : "bg-accent-muted text-accent"}`}>
                  {log.channel === "email" ? "📧" : "💬"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold truncate">{log.customers?.name ?? "Onbekend"}</div>
                  <div className="text-[11px] text-t3 truncate">{log.subject || (log.body as string)?.substring(0, 60) || "—"}</div>
                </div>
                <div className="text-[10px] text-t3 font-mono flex-shrink-0">
                  {format(new Date(log.created_at), "HH:mm")}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Appointments */}
      <div className="bg-card border border-border rounded-lg shadow-card mb-5 overflow-hidden">
        <div className="px-4 md:px-5 py-3 md:py-4 flex items-center justify-between border-b border-border">
          <h3 className="text-[14px] md:text-[15px] font-bold">Afspraken vandaag</h3>
          <button onClick={() => navigate("planning")} className="px-2.5 md:px-3 py-1.5 bg-card border border-border rounded-sm text-[11px] md:text-[12px] font-bold text-secondary-foreground hover:bg-bg-hover transition-colors">
            Planning →
          </button>
        </div>
        {loadingAppts ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : !todayAppts?.length ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Geen afspraken vandaag</div>
        ) : (
          <>
            {/* Desktop table */}
            <table className="w-full hidden md:table">
              <thead>
                <tr className="bg-background">
                  {["Tijd", "Klant", "Locatie", "Dienst", "Status"].map((h) => (
                    <th key={h} className="text-left px-5 py-2.5 text-[10.5px] font-bold uppercase tracking-wider text-t3 border-b border-border">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {todayAppts.map((a: any) => (
                  <tr key={a.id} className="hover:bg-bg-hover transition-colors">
                    <td className="px-5 py-3 text-[12px] font-mono">{format(new Date(a.scheduled_at), "HH:mm")}</td>
                    <td className="px-5 py-3 text-[13.5px] font-bold">{a.customers?.name ?? "—"}</td>
                    <td className="px-5 py-3 text-[13.5px]">{a.customers?.city ?? "—"}</td>
                    <td className="px-5 py-3">
                      <Badge variant={serviceColorMap[(a.services as any)?.category] || "primary"}>
                        {a.services?.name ?? "—"}
                      </Badge>
                    </td>
                    <td className="px-5 py-3"><Badge variant={statusVariant[a.status] || "cyan"}>{a.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-border">
              {todayAppts.map((a: any) => (
                <div key={a.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="font-mono text-[12px] text-t3 min-w-[40px]">{format(new Date(a.scheduled_at), "HH:mm")}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold truncate">{a.customers?.name ?? "—"}</div>
                    <div className="text-[11px] text-secondary-foreground truncate">{a.services?.name ?? "—"} · {a.customers?.city ?? "—"}</div>
                  </div>
                  <Badge variant={statusVariant[a.status] || "cyan"}>{a.status}</Badge>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        {/* Recent work orders */}
        <div className="bg-card border border-border rounded-lg shadow-card overflow-hidden">
          <div className="px-4 md:px-5 py-3 md:py-4 flex items-center justify-between border-b border-border">
            <h3 className="text-[14px] md:text-[15px] font-bold">Recente {labels.workOrders.toLowerCase()}</h3>
            <button onClick={() => navigate("workorders")} className="text-[11px] text-primary font-bold hover:underline">Alle →</button>
          </div>
          {!recentWOs?.length ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Geen {labels.workOrders.toLowerCase()}</div>
          ) : (
            <div className="divide-y divide-border">
              {recentWOs.map((wo: any) => (
                <div
                  key={wo.id}
                  onClick={() => navigate("woDetail", { workOrderId: wo.id })}
                  className="px-4 md:px-5 py-2.5 flex items-center gap-3 hover:bg-bg-hover transition-colors cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold truncate">{wo.customers?.name ?? "—"}</div>
                    <div className="text-[11px] text-t3 font-mono">{wo.work_order_number}</div>
                  </div>
                  <Badge variant={woStatusVariant[wo.status] || "cyan"}>{wo.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reminders */}
        <div className="bg-card border border-border rounded-lg shadow-card overflow-hidden">
          <div className="px-4 md:px-5 py-3 md:py-4 flex items-center justify-between border-b border-border">
            <h3 className="text-[14px] md:text-[15px] font-bold">Herinnering nodig</h3>
            {reminders && <Badge variant="warning">{reminders.length} klanten</Badge>}
          </div>
          {loadingReminders ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : !reminders?.length ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Geen herinneringen</div>
          ) : (
            <div className="divide-y divide-border">
              {reminders.slice(0, 5).map((r: any) => (
                <div key={r.id} className="px-4 md:px-5 py-2.5 flex items-center gap-3 hover:bg-bg-hover transition-colors cursor-pointer" onClick={() => navigate("custDetail", { customerId: r.id })}>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold truncate">{r.name}</div>
                    <div className="text-[11px] text-t3 font-mono">{format(new Date(r.lastServiceDate), "dd-MM-yyyy")}</div>
                  </div>
                  <button onClick={(e) => e.stopPropagation()} className="px-2.5 py-1 bg-accent text-accent-foreground rounded-sm text-[11px] font-bold hover:bg-accent-hover transition-colors flex-shrink-0">
                    Stuur
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <MaintenancePlannerWidget />

        <TodoWidget />
      </div>

      <AppointmentDialog open={apptDialogOpen} onOpenChange={setApptDialogOpen} />
      <WorkOrderDialog open={woDialogOpen} onOpenChange={setWoDialogOpen} />
      <InvoiceDialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen} />
    </div>
  );
};

export default DashboardPage;
