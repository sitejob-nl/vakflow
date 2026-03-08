import { useMemo, useState, useCallback } from "react";
import { format, addDays, startOfWeek, isSameDay, isToday } from "date-fns";
import { nl } from "date-fns/locale";
import { useWorkshopBays } from "@/hooks/useVehicles";
import { useWorkOrders, useUpdateWorkOrder, type WorkOrder } from "@/hooks/useWorkOrders";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Wrench, AlertTriangle, ChevronLeft, ChevronRight, Clock, Filter, Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const START_HOUR = 7;
const END_HOUR = 18;
const SLOT_WIDTH = 56; // px per 30-min slot
const ROW_HEIGHT = 72; // px per bay row
const SLOTS = Array.from({ length: (END_HOUR - START_HOUR) * 2 }, (_, i) => {
  const totalMin = START_HOUR * 60 + i * 30;
  return { hour: Math.floor(totalMin / 60), minute: totalMin % 60 };
});

// Colors by work_order_type
const typeColors: Record<string, { bg: string; border: string; text: string }> = {
  apk:       { bg: "#16a34a20", border: "#16a34a", text: "#15803d" },
  storing:   { bg: "#dc262620", border: "#dc2626", text: "#b91c1c" },
  onderhoud: { bg: "#2563eb20", border: "#2563eb", text: "#1d4ed8" },
  reparatie: { bg: "#ea580c20", border: "#ea580c", text: "#c2410c" },
  banden:    { bg: "#7c3aed20", border: "#7c3aed", text: "#6d28d9" },
};
const defaultColor = { bg: "#64748b18", border: "#64748b", text: "#475569" };

const typeLabel: Record<string, string> = {
  apk: "APK",
  storing: "Storing",
  onderhoud: "Beurt",
  reparatie: "Reparatie",
  banden: "Banden",
};

interface Props {
  currentDate: Date;
}

const WorkshopBayView = ({ currentDate }: Props) => {
  const { toast } = useToast();
  const { data: bays, isLoading: loadingBays } = useWorkshopBays();
  const { data: allWorkOrders, isLoading: loadingWOs } = useWorkOrders();
  const updateWorkOrder = useUpdateWorkOrder();

  // Week navigation
  const [weekStart, setWeekStart] = useState(() => startOfWeek(currentDate, { weekStartsOn: 1 }));
  const weekDays = useMemo(() => Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const [selectedDay, setSelectedDay] = useState<Date>(currentDate);

  const [dragWoId, setDragWoId] = useState<string | null>(null);
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);

  const activeBays = useMemo(() => (bays ?? []).filter((b) => b.is_active), [bays]);

  // Filter WOs for selected day
  const dayWorkOrders = useMemo(() => {
    if (!allWorkOrders) return [];
    return allWorkOrders.filter((wo) => {
      const scheduledAt = (wo as any).scheduled_at;
      if (scheduledAt && isSameDay(new Date(scheduledAt), selectedDay)) return true;
      if ((wo as any).bay_id && isSameDay(new Date(wo.created_at), selectedDay) && wo.status !== "afgerond") return true;
      return false;
    });
  }, [allWorkOrders, selectedDay]);

  // Group by bay
  const woByBay = useMemo(() => {
    const map = new Map<string, WorkOrder[]>();
    dayWorkOrders.forEach((wo) => {
      const bayId = (wo as any).bay_id;
      if (bayId) {
        if (!map.has(bayId)) map.set(bayId, []);
        map.get(bayId)!.push(wo);
      }
    });
    return map;
  }, [dayWorkOrders]);

  const unassignedWOs = useMemo(() => dayWorkOrders.filter((wo) => !(wo as any).bay_id), [dayWorkOrders]);

  // Get horizontal position and width for a WO block
  const getWoLayout = (wo: WorkOrder) => {
    const scheduledAt = (wo as any).scheduled_at;
    if (!scheduledAt) return null;
    const d = new Date(scheduledAt);
    const h = d.getHours();
    const m = d.getMinutes();
    if (h < START_HOUR || h >= END_HOUR) return null;
    const minutesSinceStart = (h - START_HOUR) * 60 + m;
    const left = (minutesSinceStart / 30) * SLOT_WIDTH;
    const duration = (wo as any).estimated_duration_minutes || (wo as any).duration_minutes || 60;
    const width = Math.max((duration / 30) * SLOT_WIDTH - 2, SLOT_WIDTH - 2);
    return { left, width };
  };

  const getColors = (wo: WorkOrder) => {
    const woType = ((wo as any).work_order_type ?? "").toLowerCase();
    return typeColors[woType] ?? defaultColor;
  };

  const getTypeLabel = (wo: WorkOrder) => {
    const woType = ((wo as any).work_order_type ?? "").toLowerCase();
    return typeLabel[woType] ?? (wo as any).work_order_type ?? "";
  };

  // Drag & drop
  const handleDragStart = (e: React.DragEvent, woId: string) => {
    e.stopPropagation();
    setDragWoId(woId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", woId);
  };

  const handleDrop = useCallback(async (e: React.DragEvent, bayId: string, hour: number, minute: number) => {
    e.preventDefault();
    setDragOverCell(null);
    const woId = e.dataTransfer.getData("text/plain") || dragWoId;
    setDragWoId(null);
    if (!woId) return;
    const newDate = new Date(selectedDay);
    newDate.setHours(hour, minute, 0, 0);
    try {
      await updateWorkOrder.mutateAsync({ id: woId, bay_id: bayId, scheduled_at: newDate.toISOString() } as any);
      toast({ title: "Werkorder ingepland" });
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  }, [dragWoId, selectedDay, updateWorkOrder, toast]);

  // Conflict check
  const hasConflict = (bayId: string, wo: WorkOrder) => {
    const bayWOs = woByBay.get(bayId) ?? [];
    const scheduledAt = (wo as any).scheduled_at;
    if (!scheduledAt) return false;
    const start = new Date(scheduledAt).getTime();
    const dur = ((wo as any).estimated_duration_minutes || (wo as any).duration_minutes || 60) * 60000;
    const end = start + dur;
    return bayWOs.some((other) => {
      if (other.id === wo.id) return false;
      const os = new Date((other as any).scheduled_at).getTime();
      const od = ((other as any).estimated_duration_minutes || (other as any).duration_minutes || 60) * 60000;
      return start < os + od && end > os;
    });
  };

  if (loadingBays || loadingWOs) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!activeBays.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
        <Wrench className="h-10 w-10" />
        <p className="text-sm font-medium">Geen werkplaatsbruggen geconfigureerd</p>
        <p className="text-xs">Ga naar Instellingen → Werkplaats om bruggen toe te voegen</p>
      </div>
    );
  }

  const gridWidth = SLOTS.length * SLOT_WIDTH;
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const nowLeft = ((nowMinutes - START_HOUR * 60) / 30) * SLOT_WIDTH;
  const showNowLine = isToday(selectedDay) && nowMinutes >= START_HOUR * 60 && nowMinutes < END_HOUR * 60;

  return (
    <div className="flex flex-col h-full">
      {/* Week day tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-border bg-card">
        <button onClick={() => setWeekStart((w) => addDays(w, -7))} className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        {weekDays.map((d) => {
          const active = isSameDay(d, selectedDay);
          const today = isToday(d);
          return (
            <button
              key={d.toISOString()}
              onClick={() => setSelectedDay(d)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : today
                    ? "bg-primary/10 text-primary hover:bg-primary/20"
                    : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {format(d, "EEE d", { locale: nl })}
            </button>
          );
        })}
        <button onClick={() => setWeekStart((w) => addDays(w, 7))} className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
        {!isToday(selectedDay) && (
          <button onClick={() => { setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 })); setSelectedDay(new Date()); }} className="ml-2 px-2.5 py-1 rounded-md text-[11px] font-bold text-muted-foreground border border-border hover:bg-muted transition-colors">
            Vandaag
          </button>
        )}
      </div>

      {/* Unassigned WOs */}
      {unassignedWOs.length > 0 && (
        <div className="px-4 py-2 border-b border-border bg-muted/30">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">
            Niet ingepland ({unassignedWOs.length})
          </div>
          <div className="flex gap-2 flex-wrap">
            {unassignedWOs.map((wo) => {
              const colors = getColors(wo);
              return (
                <div
                  key={wo.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, wo.id)}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-grab active:cursor-grabbing border-l-[3px] shadow-sm"
                  style={{ backgroundColor: colors.bg, borderLeftColor: colors.border, color: colors.text }}
                >
                  <span className="font-mono opacity-70 mr-1">{wo.work_order_number}</span>
                  {wo.customers?.name ?? "—"}
                  {getTypeLabel(wo) && <span className="ml-1.5 opacity-60">· {getTypeLabel(wo)}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="px-4 py-1.5 border-b border-border flex items-center gap-3 text-[10px] font-bold">
        {Object.entries(typeColors).map(([key, c]) => (
          <div key={key} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm border" style={{ backgroundColor: c.bg, borderColor: c.border }} />
            <span style={{ color: c.text }}>{typeLabel[key] ?? key}</span>
          </div>
        ))}
      </div>

      {/* Grid: bays (Y) × time (X) */}
      <div className="flex-1 overflow-auto">
        <div className="flex" style={{ minWidth: `${120 + gridWidth}px` }}>
          {/* Bay labels column */}
          <div className="sticky left-0 z-20 bg-card border-r border-border flex-shrink-0" style={{ width: 120 }}>
            {/* Header spacer */}
            <div className="h-8 border-b border-border" />
            {activeBays.map((bay) => {
              const count = woByBay.get(bay.id)?.length ?? 0;
              return (
                <div key={bay.id} className="border-b border-border px-3 flex flex-col justify-center" style={{ height: ROW_HEIGHT }}>
                  <div className="text-[13px] font-extrabold truncate">{bay.name}</div>
                  {bay.description && <div className="text-[9px] text-muted-foreground truncate">{bay.description}</div>}
                  {count > 0 && <div className="text-[10px] font-bold text-primary">{count} WO</div>}
                </div>
              );
            })}
          </div>

          {/* Timeline area */}
          <div className="relative flex-1" style={{ width: gridWidth }}>
            {/* Hour headers */}
            <div className="flex h-8 border-b border-border sticky top-0 z-10 bg-card">
              {SLOTS.map((s, i) => (
                <div
                  key={i}
                  className={`flex-shrink-0 text-[10px] font-mono text-muted-foreground flex items-center justify-center border-r ${
                    s.minute === 0 ? "border-r-border/60" : "border-r-border/20"
                  }`}
                  style={{ width: SLOT_WIDTH }}
                >
                  {s.minute === 0 ? `${s.hour.toString().padStart(2, "0")}:00` : ""}
                </div>
              ))}
            </div>

            {/* Now line */}
            {showNowLine && (
              <div className="absolute top-8 bottom-0 z-30 pointer-events-none" style={{ left: `${nowLeft}px` }}>
                <div className="w-0.5 h-full bg-destructive" />
                <div className="absolute -top-1 -left-1 w-2.5 h-2.5 rounded-full bg-destructive" />
              </div>
            )}

            {/* Bay rows */}
            {activeBays.map((bay) => {
              const bayWOs = woByBay.get(bay.id) ?? [];
              return (
                <div key={bay.id} className="relative border-b border-border flex" style={{ height: ROW_HEIGHT }}>
                  {/* Background grid cells */}
                  {SLOTS.map((s, i) => {
                    const cellKey = `${bay.id}-${s.hour}-${s.minute}`;
                    const isOver = dragOverCell === cellKey;
                    return (
                      <div
                        key={i}
                        className={`flex-shrink-0 border-r ${s.minute === 0 ? "border-r-border/60" : "border-r-border/20"} ${
                          isOver ? "bg-primary/10" : "hover:bg-muted/20"
                        } transition-colors`}
                        style={{ width: SLOT_WIDTH, height: ROW_HEIGHT }}
                        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverCell(cellKey); }}
                        onDragLeave={() => setDragOverCell(null)}
                        onDrop={(e) => handleDrop(e, bay.id, s.hour, s.minute)}
                      />
                    );
                  })}

                  {/* WO blocks (absolutely positioned) */}
                  {bayWOs.map((wo) => {
                    const layout = getWoLayout(wo);
                    if (!layout) return null;
                    const colors = getColors(wo);
                    const conflict = hasConflict(bay.id, wo);
                    return (
                      <div
                        key={wo.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, wo.id)}
                        className="absolute top-[4px] z-[2] cursor-grab active:cursor-grabbing"
                        style={{ left: layout.left, width: layout.width, height: ROW_HEIGHT - 8 }}
                      >
                        <div
                          className="h-full rounded-lg px-2 py-1 overflow-hidden border-l-[3px] hover:scale-y-105 transition-transform shadow-sm"
                          style={{ backgroundColor: colors.bg, borderLeftColor: colors.border, color: colors.text }}
                        >
                          <div className="flex items-center gap-1">
                            {conflict && <AlertTriangle className="h-3 w-3 text-destructive flex-shrink-0" />}
                            <span className="text-[10px] font-mono opacity-70">{wo.work_order_number}</span>
                            {getTypeLabel(wo) && (
                              <span className="text-[9px] font-bold uppercase tracking-wide opacity-60">{getTypeLabel(wo)}</span>
                            )}
                          </div>
                          <div className="text-[12px] font-extrabold truncate mt-0.5">
                            {wo.customers?.name ?? "—"}
                          </div>
                          {layout.width > SLOT_WIDTH * 1.5 && (
                            <div className="text-[10px] opacity-60 truncate">
                              {wo.services?.name ?? ""}{wo.customers?.city ? ` · ${wo.customers.city}` : ""}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkshopBayView;
