import { useMemo } from "react";
import { format, addDays, startOfWeek, isSameDay, isToday } from "date-fns";
import { nl } from "date-fns/locale";
import { useWorkshopBays } from "@/hooks/useVehicles";
import { useWorkOrders, type WorkOrder } from "@/hooks/useWorkOrders";
import { BarChart3, TrendingUp } from "lucide-react";

const WORK_HOURS_PER_DAY = 10; // 7:00–17:00 = 10h = 600 min

interface Props {
  currentDate: Date;
  mode: "day" | "week";
}

const WorkshopCapacityOverview = ({ currentDate, mode }: Props) => {
  const { data: bays } = useWorkshopBays();
  const { data: allWorkOrders } = useWorkOrders();

  const activeBays = useMemo(() => (bays ?? []).filter((b) => b.is_active), [bays]);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const dates = useMemo(() => {
    if (mode === "day") return [currentDate];
    return Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
  }, [currentDate, mode, weekStart]);

  // Calculate capacity per day per bay
  const capacityData = useMemo(() => {
    if (!allWorkOrders || !activeBays.length) return [];

    return dates.map((date) => {
      const dayWOs = allWorkOrders.filter((wo) => {
        const scheduledAt = (wo as any).scheduled_at;
        if (scheduledAt && isSameDay(new Date(scheduledAt), date)) return true;
        if ((wo as any).bay_id && isSameDay(new Date(wo.created_at), date) && wo.status !== "afgerond") return true;
        return false;
      });

      const bayStats = activeBays.map((bay) => {
        const bayWOs = dayWOs.filter((wo) => (wo as any).bay_id === bay.id);
        const totalMinutes = bayWOs.reduce((sum, wo) => {
          const dur = (wo as any).estimated_duration_minutes || (wo as any).duration_minutes || 60;
          return sum + dur;
        }, 0);
        const occupancy = Math.min((totalMinutes / (WORK_HOURS_PER_DAY * 60)) * 100, 100);
        return { bayId: bay.id, bayName: bay.name, woCount: bayWOs.length, totalMinutes, occupancy };
      });

      const totalOccupied = bayStats.reduce((s, b) => s + b.totalMinutes, 0);
      const totalCapacity = activeBays.length * WORK_HOURS_PER_DAY * 60;
      const avgOccupancy = totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0;
      const unassigned = dayWOs.filter((wo) => !(wo as any).bay_id).length;

      return { date, bayStats, avgOccupancy, totalWOs: dayWOs.length, unassigned };
    });
  }, [dates, allWorkOrders, activeBays]);

  if (!activeBays.length) return null;

  const getOccupancyColor = (pct: number) => {
    if (pct >= 90) return "bg-destructive";
    if (pct >= 70) return "bg-warning";
    if (pct >= 40) return "bg-primary";
    return "bg-muted-foreground/30";
  };

  const getOccupancyTextColor = (pct: number) => {
    if (pct >= 90) return "text-destructive";
    if (pct >= 70) return "text-warning";
    return "text-primary";
  };

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-primary" />
        <h3 className="text-[15px] font-extrabold">Werkplaats capaciteit</h3>
        <span className="text-[11px] text-muted-foreground font-semibold ml-auto">
          {activeBays.length} bruggen
        </span>
      </div>

      <div className="p-4 space-y-4">
        {capacityData.map(({ date, bayStats, avgOccupancy, totalWOs, unassigned }) => (
          <div key={date.toISOString()}>
            {/* Day header */}
            {mode === "week" && (
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[12px] font-extrabold ${isToday(date) ? "text-primary" : ""}`}>
                  {format(date, "EEE d MMM", { locale: nl })}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">{totalWOs} WO</span>
                  {unassigned > 0 && (
                    <span className="text-[10px] font-bold text-warning bg-warning/10 px-1.5 py-0.5 rounded-full">
                      {unassigned} wachtrij
                    </span>
                  )}
                </div>
              </div>
            )}

            {mode === "day" && (
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className={`h-4 w-4 ${getOccupancyTextColor(avgOccupancy)}`} />
                  <span className={`text-2xl font-extrabold ${getOccupancyTextColor(avgOccupancy)}`}>
                    {avgOccupancy}%
                  </span>
                  <span className="text-[12px] text-muted-foreground">bezet</span>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-bold">{totalWOs} werkbonnen</p>
                  {unassigned > 0 && (
                    <p className="text-[11px] font-bold text-warning">{unassigned} in wachtrij</p>
                  )}
                </div>
              </div>
            )}

            {/* Per-bay bars */}
            <div className="space-y-1.5">
              {bayStats.map((bs) => (
                <div key={bs.bayId} className="flex items-center gap-2">
                  <span className="text-[11px] font-bold w-16 truncate">{bs.bayName}</span>
                  <div className="flex-1 h-4 bg-muted/50 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${getOccupancyColor(bs.occupancy)}`}
                      style={{ width: `${bs.occupancy}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground w-10 text-right">
                    {Math.round(bs.occupancy)}%
                  </span>
                  <span className="text-[10px] text-muted-foreground w-6 text-right">
                    {bs.woCount}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WorkshopCapacityOverview;
