import { useNavigation } from "@/hooks/useNavigation";
import { useState, useCallback } from "react";
import { Check, Clock, Calendar, Loader2, Plus, RefreshCw, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePaginatedWorkOrders } from "@/hooks/useWorkOrders";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useAuth } from "@/contexts/AuthContext";
import { useIndustryConfig } from "@/hooks/useIndustryConfig";
import WorkOrderDialog from "@/components/WorkOrderDialog";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const tabs = ["Alle", "Open", "Bezig", "Afgerond"];
const PAGE_SIZE = 25;

const statusConfig: Record<string, { badge: string; icon: typeof Check; iconBg: string }> = {
  open: { badge: "bg-cyan-muted text-cyan", icon: Calendar, iconBg: "bg-cyan-muted text-cyan" },
  bezig: { badge: "bg-warning-muted text-warning", icon: Clock, iconBg: "bg-warning-muted text-warning" },
  afgerond: { badge: "bg-success-muted text-success", icon: Check, iconBg: "bg-success-muted text-success" },
};

const statusLabel: Record<string, string> = {
  open: "Open",
  bezig: "Bezig",
  afgerond: "Afgerond",
};

const WorkOrdersPage = () => {
  const { navigate } = useNavigation();
  const { isAdmin } = useAuth();
  const { labels } = useIndustryConfig();
  const [activeTab, setActiveTab] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [filterEmployee, setFilterEmployee] = useState<string>("all");
  const queryClient = useQueryClient();
  const { data: teamMembers } = useTeamMembers();

  const statusFilter = activeTab === 0 ? null : ["open", "bezig", "afgerond"][activeTab - 1];

  const { data: result, isLoading } = usePaginatedWorkOrders({
    page,
    pageSize: PAGE_SIZE,
    statusFilter,
    assignedToFilter: filterEmployee !== "all" ? filterEmployee : null,
  });

  const workOrders = result?.data ?? [];
  const totalCount = result?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const handleRefresh = useCallback(() => {
    return queryClient.invalidateQueries({ queryKey: ["work_orders-paginated"] });
  }, [queryClient]);

  const { containerRef, pullDistance, refreshing, isTriggered } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  return (
    <div ref={containerRef}>
      {/* Pull-to-refresh indicator */}
      <div
        className="flex justify-center items-center overflow-hidden transition-all duration-200 lg:hidden"
        style={{ height: pullDistance > 0 ? `${pullDistance}px` : 0 }}
      >
        <RefreshCw
          className={`w-5 h-5 text-primary transition-transform duration-200 ${refreshing ? "animate-spin" : ""}`}
          style={{ transform: `rotate(${Math.min(pullDistance * 3, 360)}deg)`, opacity: Math.min(pullDistance / 40, 1) }}
        />
        {isTriggered && !refreshing && (
          <span className="ml-2 text-[11px] font-semibold text-primary">Loslaten om te verversen</span>
        )}
      </div>

      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="flex gap-0 border-b-2 border-border flex-1 overflow-x-auto scrollbar-hide">
          {tabs.map((t, i) => (
            <button key={t} onClick={() => { setActiveTab(i); setPage(0); }} className={`px-3 md:px-5 py-2.5 text-[13px] font-bold border-b-2 -mb-[2px] transition-colors whitespace-nowrap ${i === activeTab ? "text-primary border-primary" : "text-t3 border-transparent hover:text-secondary-foreground"}`}>
              {t}
            </button>
          ))}
        </div>
        {/* Monteur filter - alleen voor admins */}
        {isAdmin && teamMembers && teamMembers.length > 1 && (
          <Select value={filterEmployee} onValueChange={(v) => { setFilterEmployee(v); setPage(0); }}>
            <SelectTrigger className="w-[160px] h-8 text-[12px] flex-shrink-0">
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
        <button
          onClick={() => setDialogOpen(true)}
          className="hidden lg:flex ml-3 px-3 py-1.5 bg-primary text-primary-foreground rounded-sm text-[12px] font-bold hover:bg-primary-hover transition-colors items-center gap-1 flex-shrink-0"
        >
          <Plus className="h-3.5 w-3.5" /> Nieuwe {labels.workOrder.toLowerCase()}
        </button>
      </div>

      {/* Mobile FAB */}
      <button
        onClick={() => setDialogOpen(true)}
        className="lg:hidden fixed right-4 bottom-[calc(72px+env(safe-area-inset-bottom,0px))] z-30 w-12 h-12 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center hover:bg-primary-hover transition-colors"
        aria-label={`Nieuwe ${labels.workOrder.toLowerCase()}`}
      >
        <Plus className="h-5 w-5" />
      </button>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : workOrders.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          {activeTab > 0 ? `Geen ${labels.workOrders.toLowerCase()} met deze status` : `Nog geen ${labels.workOrders.toLowerCase()}. Maak je eerste ${labels.workOrder.toLowerCase()} aan!`}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {workOrders.map((wo) => {
              const config = statusConfig[wo.status] ?? statusConfig.open;
              const Icon = config.icon;
              return (
                <div
                  key={wo.id}
                  onClick={() => navigate("woDetail", { workOrderId: wo.id })}
                  className="bg-card border border-border rounded-lg p-3 md:p-4 px-4 md:px-5 grid grid-cols-[auto_1fr_auto] gap-3 md:gap-4 items-center shadow-card hover:border-primary hover:shadow-card-hover hover:-translate-y-px transition-all cursor-pointer"
                >
                  <div className={`w-[38px] h-[38px] md:w-[42px] md:h-[42px] rounded-[10px] flex items-center justify-center ${config.iconBg}`}>
                    <Icon className="w-4 h-4 md:w-5 md:h-5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-[13px] md:text-sm font-bold truncate flex items-center gap-1.5">
                      {wo.customers?.name ?? "Onbekend"} — {wo.services?.name ?? "Dienst"}
                      {(wo.services as any)?.category && (
                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 font-semibold ${(wo.services as any).category.startsWith('MV') ? 'border-blue-400 text-blue-500' : 'border-amber-400 text-amber-500'}`}>
                          {(wo.services as any).category.startsWith('MV') ? 'MV' : 'WTW'}
                        </Badge>
                      )}
                    </h4>
                    <p className="text-[11.5px] md:text-[12.5px] text-secondary-foreground truncate">
                      {format(new Date(wo.created_at), "d MMM yyyy", { locale: nl })} · {wo.customers?.city ?? ""}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`inline-flex px-2.5 py-[3px] rounded-full text-[11px] font-bold ${config.badge}`}>
                      {statusLabel[wo.status] ?? wo.status}
                    </span>
                    <div className="text-[10.5px] text-t3 font-mono mt-1">{wo.work_order_number}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-[12px] text-muted-foreground">
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} van {totalCount}
              </span>
              <div className="flex gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <WorkOrderDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
};

export default WorkOrdersPage;
