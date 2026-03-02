import { useMemo } from "react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth,
  isSameDay, isToday, format,
} from "date-fns";
import { nl } from "date-fns/locale";
import type { Appointment } from "@/hooks/useAppointments";

interface Props {
  currentMonth: Date;
  appointments: Appointment[];
  onDayClick: (day: Date) => void;
}

const MonthView = ({ currentMonth, appointments, onDayClick }: Props) => {
  const weeks = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const result: Date[][] = [];
    let day = calStart;
    while (day <= calEnd) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(day);
        day = addDays(day, 1);
      }
      result.push(week);
    }
    return result;
  }, [currentMonth]);

  // Group appointments by date string
  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    appointments.forEach((a) => {
      const key = format(new Date(a.scheduled_at), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    });
    return map;
  }, [appointments]);

  const dayNames = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

  return (
    <div className="p-2 md:p-4">
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {dayNames.map((d) => (
          <div key={d} className="text-center text-[11px] font-bold text-muted-foreground uppercase tracking-wide py-1.5">
            {d}
          </div>
        ))}
      </div>

      {/* Weeks */}
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7">
          {week.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayApps = appointmentsByDate.get(key) ?? [];
            const inMonth = isSameMonth(day, currentMonth);
            const today = isToday(day);

            // Group by status for colored dots
            const statusCounts: Record<string, number> = {};
            dayApps.forEach((a) => {
              statusCounts[a.status] = (statusCounts[a.status] ?? 0) + 1;
            });

            return (
              <div
                key={key}
                className={`
                  min-h-[60px] md:min-h-[80px] border border-border/30 p-1 cursor-pointer
                  hover:bg-muted/50 transition-colors
                  ${!inMonth ? "opacity-30" : ""}
                  ${today ? "bg-primary/5 border-primary/30" : ""}
                `}
                onClick={() => onDayClick(day)}
              >
                <div className={`text-[11px] font-bold mb-0.5 ${today ? "text-primary" : "text-foreground"}`}>
                  {format(day, "d")}
                </div>

                {/* Dots for appointments */}
                {dayApps.length > 0 && (
                  <div className="flex flex-wrap gap-[3px]">
                    {dayApps.length <= 5 ? (
                      dayApps.map((a) => {
                        const color = a.services?.color || "#3b82f6";
                        return (
                          <div
                            key={a.id}
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: color }}
                            title={`${format(new Date(a.scheduled_at), "HH:mm")} ${a.customers?.name ?? ""}`}
                          />
                        );
                      })
                    ) : (
                      <>
                        {dayApps.slice(0, 4).map((a) => {
                          const color = a.services?.color || "#3b82f6";
                          return (
                            <div
                              key={a.id}
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: color }}
                            />
                          );
                        })}
                        <span className="text-[9px] font-bold text-muted-foreground">+{dayApps.length - 4}</span>
                      </>
                    )}
                  </div>
                )}

                {/* Count badge on mobile */}
                {dayApps.length > 0 && (
                  <div className="text-[10px] font-semibold text-muted-foreground mt-0.5 md:hidden">
                    {dayApps.length}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default MonthView;
