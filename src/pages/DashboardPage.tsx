import { useNavigation } from "@/hooks/useNavigation";
import { useTodayAppointments, useDashboardStats, useReminders, useRecentWorkOrders } from "@/hooks/useDashboard";
import TodoWidget from "@/components/TodoWidget";
import MaintenancePlannerWidget from "@/components/MaintenancePlannerWidget";
import OnboardingChecklist from "@/components/OnboardingChecklist";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Loader2, CalendarPlus, FileText, Receipt, Car, AlertTriangle, Wrench } from "lucide-react";
import { useState } from "react";
import AppointmentDialog from "@/components/AppointmentDialog";
import WorkOrderDialog from "@/components/WorkOrderDialog";
import InvoiceDialog from "@/components/InvoiceDialog";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useQueryClient } from "@tanstack/react-query";
import { useIndustryConfig } from "@/hooks/useIndustryConfig";
import { useAutomotiveDashboardStats } from "@/hooks/useAutomotiveDashboard";

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
  const { labels } = useIndustryConfig();
  const { data: todayAppts, isLoading: loadingAppts } = useTodayAppointments();
  const { data: stats, isLoading: loadingStats } = useDashboardStats();
  const { data: reminders, isLoading: loadingReminders } = useReminders();
  const { data: recentWOs } = useRecentWorkOrders();

  const [apptDialogOpen, setApptDialogOpen] = useState(false);
  const [woDialogOpen, setWoDialogOpen] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);

  const { containerRef, pullDistance, refreshing } = usePullToRefresh({
    onRefresh: () => queryClient.invalidateQueries() as Promise<unknown>,
  });

  const loading = loadingAppts || loadingStats;

  const kpiCards = [
    { label: "Afspraken vandaag", value: stats?.appointmentsToday ?? "—", page: "planning" as const },
    { label: `Open ${labels.workOrders.toLowerCase()}`, value: stats?.openWorkOrders ?? "—", page: "workorders" as const },
    { label: `Betaalde omzet ${format(new Date(), "MMM", { locale: nl })}`, value: stats ? formatCurrency(stats.revenueMonth) : "—", page: "invoices" as const },
    { label: "Openstaand", value: stats ? formatCurrency(stats.outstandingAmount) : "—", sub: stats ? `${stats.outstandingCount} facturen` : undefined, page: "invoices" as const },
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

      {/* Quick actions */}
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
