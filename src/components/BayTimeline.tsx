import { useMemo } from "react";
import { useWorkshopBays, type WorkshopBay } from "@/hooks/useVehicles";
import { useAppointmentsForDay } from "@/hooks/useAppointments";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Settings, Wrench } from "lucide-react";
import { useNavigation } from "@/hooks/useNavigation";

interface Props {
  date: Date;
  onSelectSlot?: (bayId: string, hour: number) => void;
}

const HOURS = Array.from({ length: 10 }, (_, i) => i + 8); // 08:00 - 17:00

const BayTimeline = ({ date, onSelectSlot }: Props) => {
  const { data: bays } = useWorkshopBays();
  const { data: dayAppointments } = useAppointmentsForDay(date, null);
  const { navigate } = useNavigation();

  const activeBays = useMemo(() => (bays ?? []).filter((b) => b.is_active), [bays]);

  // Group appointments by bay_id
  const appointmentsByBay = useMemo(() => {
    if (!dayAppointments) return new Map<string, any[]>();
    const map = new Map<string, any[]>();
    dayAppointments.forEach((a: any) => {
      const bayId = a.bay_id;
      if (!bayId) return;
      if (!map.has(bayId)) map.set(bayId, []);
      map.get(bayId)!.push(a);
    });
    return map;
  }, [dayAppointments]);

  if (!activeBays.length) {
    return (
      <div className="border border-border rounded-lg p-4 bg-muted/30 text-center">
        <Wrench className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground mb-2">Geen werkplaatsbruggen geconfigureerd</p>
        <button
          onClick={() => navigate("settings" as any)}
          className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 mx-auto"
        >
          <Settings className="h-3 w-3" /> Bruggen instellen
        </button>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      <div className="text-xs font-semibold text-muted-foreground p-2 bg-muted/30 border-b border-border">
        Brugplanning — {format(date, "EEEE d MMMM")}
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Time header */}
          <div className="flex border-b border-border">
            <div className="w-24 flex-shrink-0 p-1.5 text-[10px] font-semibold text-muted-foreground">Brug</div>
            {HOURS.map((h) => (
              <div key={h} className="flex-1 p-1.5 text-[10px] text-muted-foreground text-center border-l border-border">
                {h}:00
              </div>
            ))}
          </div>

          {/* Bay rows */}
          {activeBays.map((bay) => {
            const appointments = appointmentsByBay.get(bay.id) ?? [];
            return (
              <div key={bay.id} className="flex border-b border-border last:border-b-0 min-h-[40px]">
                <div className="w-24 flex-shrink-0 p-1.5 text-[11px] font-medium flex items-center">
                  {bay.name}
                </div>
                <div className="flex-1 relative">
                  {/* Hour grid */}
                  <div className="flex h-full">
                    {HOURS.map((h) => (
                      <div
                        key={h}
                        className="flex-1 border-l border-border cursor-pointer hover:bg-primary/5 transition-colors"
                        onClick={() => onSelectSlot?.(bay.id, h)}
                      />
                    ))}
                  </div>
                  {/* Appointment blocks */}
                  {appointments.map((apt: any) => {
                    const start = new Date(apt.scheduled_at);
                    const startHour = start.getHours() + start.getMinutes() / 60;
                    const duration = (apt.duration_minutes ?? 60) / 60;
                    const leftPercent = ((startHour - 8) / HOURS.length) * 100;
                    const widthPercent = (duration / HOURS.length) * 100;

                    if (leftPercent < 0 || leftPercent >= 100) return null;

                    return (
                      <div
                        key={apt.id}
                        className="absolute top-0.5 bottom-0.5 bg-primary/20 border border-primary/40 rounded text-[9px] px-1 flex items-center overflow-hidden"
                        style={{
                          left: `${Math.max(0, leftPercent)}%`,
                          width: `${Math.min(widthPercent, 100 - leftPercent)}%`,
                        }}
                        title={`${(apt.customers as any)?.name ?? "Klant"} — ${start.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}`}
                      >
                        <span className="truncate font-medium text-primary">
                          {(apt.customers as any)?.name?.split(" ")[0] ?? ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BayTimeline;
