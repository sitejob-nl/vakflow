import { useMaintenancePlanner } from "@/hooks/useMaintenancePlanner";
import { useNavigation } from "@/hooks/useNavigation";
import { AlertTriangle, Wrench, Loader2 } from "lucide-react";
import { format } from "date-fns";

const MaintenancePlannerWidget = () => {
  const { navigate } = useNavigation();
  const { data, isLoading } = useMaintenancePlanner();

  const overdue = data?.overdue ?? [];
  const upcoming = data?.upcoming.filter((u) => (u.days_until ?? 99) <= 30) ?? [];

  return (
    <div className="bg-card border border-border rounded-lg shadow-card overflow-hidden">
      <div className="px-4 md:px-5 py-3 md:py-4 flex items-center justify-between border-b border-border">
        <h3 className="text-[14px] md:text-[15px] font-bold flex items-center gap-2">
          <Wrench className="h-4 w-4" /> Onderhoud
        </h3>
        {overdue.length > 0 && (
          <span className="inline-flex items-center gap-1 px-2.5 py-[3px] rounded-full text-[11px] font-bold bg-destructive-muted text-destructive">
            <AlertTriangle className="h-3 w-3" /> {overdue.length} achterstallig
          </span>
        )}
      </div>
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : overdue.length === 0 && upcoming.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Geen gepland onderhoud
        </div>
      ) : (
        <div className="divide-y divide-border">
          {overdue.slice(0, 3).map((item) => (
            <div
              key={item.id}
              onClick={() => navigate("assets")}
              className="px-4 md:px-5 py-2.5 flex items-center gap-3 hover:bg-bg-hover transition-colors cursor-pointer"
            >
              <div className="w-2 h-2 rounded-full bg-destructive flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold truncate">{item.name}</div>
                <div className="text-[11px] text-t3">
                  {item.customer?.name ?? "—"} · {item.days_overdue}d te laat
                </div>
              </div>
              {item.next_service_due && (
                <span className="text-[11px] font-mono text-destructive flex-shrink-0">
                  {format(new Date(item.next_service_due), "dd-MM")}
                </span>
              )}
            </div>
          ))}
          {upcoming.slice(0, 3).map((item) => (
            <div
              key={item.id}
              onClick={() => navigate("assets")}
              className="px-4 md:px-5 py-2.5 flex items-center gap-3 hover:bg-bg-hover transition-colors cursor-pointer"
            >
              <div className="w-2 h-2 rounded-full bg-warning flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold truncate">{item.name}</div>
                <div className="text-[11px] text-t3">
                  {item.customer?.name ?? "—"} · over {item.days_until}d
                </div>
              </div>
              {item.next_maintenance_date && (
                <span className="text-[11px] font-mono text-warning flex-shrink-0">
                  {format(new Date(item.next_maintenance_date), "dd-MM")}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MaintenancePlannerWidget;
