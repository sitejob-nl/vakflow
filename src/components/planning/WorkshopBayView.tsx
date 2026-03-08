import { useMemo, useState, useCallback } from "react";
import { format, isSameDay, isToday } from "date-fns";
import { nl } from "date-fns/locale";
import { useWorkshopBays, type WorkshopBay } from "@/hooks/useVehicles";
import { useWorkOrders, useUpdateWorkOrder, type WorkOrder } from "@/hooks/useWorkOrders";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Wrench, AlertTriangle } from "lucide-react";
import CurrentTimeIndicator from "./CurrentTimeIndicator";

const SLOT_HEIGHT = 32;
const START_HOUR = 7;
const END_HOUR = 19;
const SLOTS_PER_HOUR = 2; // 30-min slots
const TOTAL_SLOTS = (END_HOUR - START_HOUR) * SLOTS_PER_HOUR;

const slots = Array.from({ length: TOTAL_SLOTS }, (_, i) => {
  const totalMinutes = START_HOUR * 60 + i * 30;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return {
    hour,
    minute,
    label: `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`,
  };
});

const statusColors: Record<string, { bg: string; border: string; text: string }> = {
  open: { bg: "hsl(var(--primary) / 0.12)", border: "hsl(var(--primary))", text: "hsl(var(--primary))" },
  bezig: { bg: "hsl(var(--warning) / 0.15)", border: "hsl(var(--warning))", text: "hsl(var(--warning))" },
  afgerond: { bg: "hsl(var(--accent) / 0.12)", border: "hsl(var(--accent))", text: "hsl(var(--accent))" },
};

interface Props {
  currentDate: Date;
}

const WorkshopBayView = ({ currentDate }: Props) => {
  const { toast } = useToast();
  const { data: bays, isLoading: loadingBays } = useWorkshopBays();
  const { data: allWorkOrders, isLoading: loadingWOs } = useWorkOrders();
  const updateWorkOrder = useUpdateWorkOrder();

  const [dragWoId, setDragWoId] = useState<string | null>(null);
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);

  // Filter work orders for the current date that have a bay assigned or are open
  const dayWorkOrders = useMemo(() => {
    if (!allWorkOrders) return [];
    return allWorkOrders.filter((wo) => {
      if (wo.status === "afgerond") return false;
      // Show WOs that have a scheduled time on this day or are assigned to a bay
      const scheduledAt = (wo as any).scheduled_at;
      if (scheduledAt && isSameDay(new Date(scheduledAt), currentDate)) return true;
      // Also show if bay_id is set and created today
      if ((wo as any).bay_id && isSameDay(new Date(wo.created_at), currentDate)) return true;
      return false;
    });
  }, [allWorkOrders, currentDate]);

  // Map: bay_id -> work orders on that bay
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

  // Unassigned work orders (no bay)
  const unassignedWOs = useMemo(() => {
    return dayWorkOrders.filter((wo) => !(wo as any).bay_id);
  }, [dayWorkOrders]);

  // Get WO position on timeline
  const getWoPosition = (wo: WorkOrder) => {
    const scheduledAt = (wo as any).scheduled_at;
    if (!scheduledAt) return null;
    const d = new Date(scheduledAt);
    const hour = d.getHours();
    const minute = d.getMinutes();
    if (hour < START_HOUR || hour >= END_HOUR) return null;
    const slotIndex = (hour - START_HOUR) * SLOTS_PER_HOUR + Math.floor(minute / 30);
    const minuteOffset = minute % 30;
    const topPx = slotIndex * SLOT_HEIGHT + (minuteOffset / 30) * SLOT_HEIGHT;
    const durationMin = (wo as any).estimated_duration_minutes || 60;
    const heightPx = Math.max((durationMin / 30) * SLOT_HEIGHT - 2, SLOT_HEIGHT - 2);
    return { topPx, heightPx };
  };

  // Check for overbooking (multiple WOs on same bay at same time)
  const hasConflict = (bayId: string, wo: WorkOrder) => {
    const bayWOs = woByBay.get(bayId) ?? [];
    const scheduledAt = (wo as any).scheduled_at;
    if (!scheduledAt) return false;
    const start = new Date(scheduledAt).getTime();
    const duration = ((wo as any).estimated_duration_minutes || 60) * 60000;
    const end = start + duration;

    return bayWOs.some((other) => {
      if (other.id === wo.id) return false;
      const otherStart = new Date((other as any).scheduled_at).getTime();
      const otherDuration = ((other as any).estimated_duration_minutes || 60) * 60000;
      const otherEnd = otherStart + otherDuration;
      return start < otherEnd && end > otherStart;
    });
  };

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

    const newDate = new Date(currentDate);
    newDate.setHours(hour, minute, 0, 0);

    try {
      await updateWorkOrder.mutateAsync({
        id: woId,
        bay_id: bayId,
        scheduled_at: newDate.toISOString(),
      } as any);
      toast({ title: "Werkorder toegewezen", description: `Brug bijgewerkt` });
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  }, [dragWoId, currentDate, updateWorkOrder, toast]);

  const activeBays = useMemo(() => {
    return (bays ?? []).filter((b) => b.is_active);
  }, [bays]);

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

  return (
    <div className="flex flex-col h-full">
      {/* Unassigned work orders */}
      {unassignedWOs.length > 0 && (
        <div className="px-4 py-2 border-b border-border bg-muted/30">
          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5">
            Niet toegewezen ({unassignedWOs.length})
          </div>
          <div className="flex gap-2 flex-wrap">
            {unassignedWOs.map((wo) => (
              <div
                key={wo.id}
                draggable
                onDragStart={(e) => handleDragStart(e, wo.id)}
                className="px-3 py-1.5 bg-card border border-border rounded-lg text-[12px] font-bold cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors shadow-sm"
              >
                <span className="font-mono text-muted-foreground mr-1.5">{wo.work_order_number}</span>
                {wo.customers?.name ?? "—"}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bay grid */}
      <div className="flex-1 overflow-auto">
        <div
          className="grid"
          style={{
            gridTemplateColumns: `80px repeat(${activeBays.length}, 1fr)`,
          }}
        >
          {/* Header row */}
          <div className="sticky top-0 z-10 bg-card border-b border-border p-2" />
          {activeBays.map((bay) => {
            const bayWoCount = woByBay.get(bay.id)?.length ?? 0;
            return (
              <div
                key={bay.id}
                className="sticky top-0 z-10 bg-card border-b border-border border-l border-l-border/40 px-3 py-2.5 text-center"
              >
                <div className="text-[13px] font-extrabold">{bay.name}</div>
                {bay.description && (
                  <div className="text-[10px] text-muted-foreground mt-0.5">{bay.description}</div>
                )}
                {bayWoCount > 0 && (
                  <div className="text-[10px] font-bold text-primary mt-0.5">{bayWoCount} werkorder{bayWoCount !== 1 ? "s" : ""}</div>
                )}
              </div>
            );
          })}

          {/* Time slots */}
          {slots.map((slot) => (
            <div key={slot.label} className="contents">
              <div
                className={`pr-2 text-right text-[10px] text-muted-foreground font-mono flex items-start justify-end border-r border-border pt-0.5 ${
                  slot.minute === 0 ? "border-b border-b-border/60" : "border-b border-b-border/20"
                }`}
                style={{ height: `${SLOT_HEIGHT}px` }}
              >
                {slot.minute === 0 ? slot.label : ""}
              </div>
              {activeBays.map((bay) => {
                const cellKey = `${bay.id}-${slot.label}`;
                const isOver = dragOverCell === cellKey;
                // Render WOs that start in this slot
                const bayWOs = (woByBay.get(bay.id) ?? []).filter((wo) => {
                  const scheduledAt = (wo as any).scheduled_at;
                  if (!scheduledAt) return false;
                  const d = new Date(scheduledAt);
                  return d.getHours() === slot.hour && Math.floor(d.getMinutes() / 30) === Math.floor(slot.minute / 30);
                });

                return (
                  <div
                    key={cellKey}
                    className={`relative border-l border-l-border/40 ${
                      slot.minute === 0 ? "border-b border-b-border/60" : "border-b border-b-border/20"
                    } ${isOver ? "bg-primary/10 ring-1 ring-inset ring-primary/30" : "hover:bg-muted/30"} transition-colors`}
                    style={{ height: `${SLOT_HEIGHT}px` }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      if (dragOverCell !== cellKey) setDragOverCell(cellKey);
                    }}
                    onDragLeave={() => setDragOverCell(null)}
                    onDrop={(e) => handleDrop(e, bay.id, slot.hour, slot.minute)}
                  >
                    {/* Current time indicator */}
                    {slot.hour === START_HOUR && slot.minute === 0 && isToday(currentDate) && (
                      <CurrentTimeIndicator startHour={START_HOUR} endHour={END_HOUR} slotHeight={SLOT_HEIGHT / (60 / 30)} />
                    )}

                    {bayWOs.map((wo) => {
                      const pos = getWoPosition(wo);
                      if (!pos) return null;
                      const conflict = hasConflict(bay.id, wo);
                      const colors = statusColors[wo.status] ?? statusColors.open;
                      const minuteOffset = new Date((wo as any).scheduled_at).getMinutes() % 30;
                      const topInCell = (minuteOffset / 30) * SLOT_HEIGHT;

                      return (
                        <div
                          key={wo.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, wo.id)}
                          className="absolute left-[2px] right-[2px] z-[2] cursor-grab active:cursor-grabbing"
                          style={{ top: `${topInCell}px`, height: `${pos.heightPx}px` }}
                        >
                          <div
                            className="rounded-lg px-2 py-1 h-full overflow-hidden border-l-[3px] hover:scale-[1.02] transition-all"
                            style={{
                              backgroundColor: colors.bg,
                              borderLeftColor: colors.border,
                              color: colors.text,
                            }}
                          >
                            <div className="flex items-center gap-1.5">
                              {conflict && <AlertTriangle className="h-3 w-3 text-destructive flex-shrink-0" />}
                              <span className="text-[10px] font-mono opacity-70">{wo.work_order_number}</span>
                            </div>
                            <div className="text-[11px] font-extrabold truncate">
                              {wo.customers?.name ?? "—"}
                            </div>
                            {pos.heightPx > SLOT_HEIGHT && (
                              <div className="text-[10px] opacity-60 truncate mt-0.5">
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
          ))}
        </div>
      </div>
    </div>
  );
};

export default WorkshopBayView;
