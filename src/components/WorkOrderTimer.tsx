import { useState, useEffect } from "react";
import { useActiveTimer, useStartTimer, useStopTimer, useTimeEntries } from "@/hooks/useTimeEntries";
import { Play, Square, Car, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}u ${m}m` : `${m}m`;
}

function LiveTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [startedAt]);

  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <span className="font-mono text-lg font-bold text-primary tabular-nums">
      {pad(h)}:{pad(m)}:{pad(s)}
    </span>
  );
}

export default function WorkOrderTimer({ workOrderId }: { workOrderId: string }) {
  const { toast } = useToast();
  const { data: activeTimer } = useActiveTimer(workOrderId);
  const { data: entries } = useTimeEntries(workOrderId);
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();

  const completedEntries = (entries ?? []).filter((e) => e.stopped_at);
  const totalMinutes = completedEntries.reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0);
  const travelMinutes = completedEntries.filter((e) => e.is_travel).reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0);
  const workMinutes = totalMinutes - travelMinutes;

  const handleStart = async (isTravel: boolean) => {
    try {
      await startTimer.mutateAsync({ workOrderId, isTravel });
    } catch (err: any) {
      toast({ title: "Fout bij starten timer", description: err.message, variant: "destructive" });
    }
  };

  const handleStop = async () => {
    if (!activeTimer) return;
    try {
      await stopTimer.mutateAsync(activeTimer.id);
      toast({ title: "Timer gestopt" });
    } catch (err: any) {
      toast({ title: "Fout bij stoppen timer", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="bg-background border border-border rounded-sm p-4">
      <h4 className="text-[11px] uppercase tracking-widest text-t3 mb-3 font-bold flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5" /> Tijdregistratie
      </h4>

      {/* Active timer */}
      {activeTimer ? (
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              {activeTimer.is_travel && <Car className="h-4 w-4 text-warning" />}
              <span className="text-[12px] text-t3 font-semibold">
                {activeTimer.is_travel ? "Reistijd" : "Werktijd"} loopt...
              </span>
            </div>
            <LiveTimer startedAt={activeTimer.started_at} />
          </div>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleStop}
            disabled={stopTimer.isPending}
            className="gap-1.5"
          >
            <Square className="h-3.5 w-3.5" /> Stop
          </Button>
        </div>
      ) : (
        <div className="flex gap-2 mb-3">
          <Button
            size="sm"
            onClick={() => handleStart(false)}
            disabled={startTimer.isPending}
            className="gap-1.5"
          >
            <Play className="h-3.5 w-3.5" /> Start werktijd
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleStart(true)}
            disabled={startTimer.isPending}
            className="gap-1.5"
          >
            <Car className="h-3.5 w-3.5" /> Start reistijd
          </Button>
        </div>
      )}

      {/* Summary */}
      {completedEntries.length > 0 && (
        <div className="border-t border-border pt-3 space-y-1.5">
          <div className="flex justify-between text-[13px]">
            <span className="text-t3">Werktijd</span>
            <span className="font-semibold">{formatDuration(workMinutes)}</span>
          </div>
          {travelMinutes > 0 && (
            <div className="flex justify-between text-[13px]">
              <span className="text-t3">Reistijd</span>
              <span className="font-semibold">{formatDuration(travelMinutes)}</span>
            </div>
          )}
          <div className="flex justify-between text-[13px] font-bold text-primary pt-1 border-t border-border">
            <span>Totaal</span>
            <span>{formatDuration(totalMinutes)}</span>
          </div>

          {/* Entry list */}
          <div className="mt-2 space-y-1">
            {completedEntries.map((e) => (
              <div key={e.id} className="flex items-center gap-2 text-[11px] text-t3">
                {e.is_travel && <Car className="h-3 w-3 text-warning" />}
                <span>
                  {format(new Date(e.started_at), "HH:mm", { locale: nl })} – {format(new Date(e.stopped_at!), "HH:mm", { locale: nl })}
                </span>
                <span className="font-semibold">{formatDuration(e.duration_minutes ?? 0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
