import { useState } from "react";
import { useReminders } from "@/hooks/useDashboard";
import { useNavigation } from "@/hooks/useNavigation";
import { useAutomationSendLogs } from "@/hooks/useWhatsAppAutomations";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";

const tabs = ["Te versturen", "Verstuurd", "Ingepland"];

const RemindersPage = () => {
  const [activeTab, setActiveTab] = useState(0);
  const { data: reminders, isLoading } = useReminders();
  const { data: sendLogs, isLoading: logsLoading } = useAutomationSendLogs("repeat_reminder");
  const { navigate } = useNavigation();
  const { toast } = useToast();
  const [scanning, setScanning] = useState(false);

  const handleScan = async () => {
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("reminder-scan", {});
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: "Scan voltooid",
        description: `${data.total_due} klanten gevonden, ${data.triggered} berichten verstuurd, ${data.skipped} overgeslagen`,
      });
    } catch (err: any) {
      toast({ title: "Scan mislukt", description: err.message, variant: "destructive" });
    }
    setScanning(false);
  };

  return (
    <div>
      <div className="flex gap-0 border-b-2 border-border mb-4 md:mb-5 overflow-x-auto scrollbar-hide">
        {tabs.map((t, i) => (
          <button key={t} onClick={() => setActiveTab(i)} className={`px-4 md:px-5 py-2.5 text-[12px] md:text-[13px] font-bold border-b-2 -mb-[2px] transition-colors whitespace-nowrap ${i === activeTab ? "text-primary border-primary" : "text-t3 border-transparent hover:text-secondary-foreground"}`}>
            {t}
            {t === "Te versturen" && reminders?.length ? <span className="ml-1.5 bg-warning-muted text-warning px-[7px] py-[2px] rounded-full text-[9px] font-bold">{reminders.length}</span> : null}
            {t === "Verstuurd" && sendLogs?.length ? <span className="ml-1.5 bg-success-muted text-success px-[7px] py-[2px] rounded-full text-[9px] font-bold">{sendLogs.length}</span> : null}
          </button>
        ))}
      </div>

      {/* Info bar */}
      <div className="mb-4 md:mb-5 p-3.5 md:p-4 px-4 md:px-5 bg-card border border-border rounded-lg shadow-card">
        <div className="text-[12px] md:text-[13px] text-secondary-foreground mb-2.5 md:mb-0">
          Automatische scan: klanten met laatste reiniging <strong className="text-foreground">≥ interval</strong> geleden.
        </div>
        <div className="flex gap-2 mt-2">
          <button onClick={() => navigate("settings")} className="px-2.5 md:px-3 py-1.5 bg-card border border-border rounded-sm text-[11px] md:text-[12px] font-bold text-secondary-foreground hover:bg-bg-hover transition-colors">⚙ Instellingen</button>
          <button
            onClick={handleScan}
            disabled={scanning}
            className="px-2.5 md:px-3 py-1.5 bg-primary text-primary-foreground rounded-sm text-[11px] md:text-[12px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            {scanning ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            {scanning ? "Scannen..." : "▶ Nu scannen"}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : activeTab === 0 ? (
        !reminders?.length ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            Geen klanten die een herinnering nodig hebben. 🎉
          </div>
        ) : (
          <div className="space-y-2.5">
            {reminders.map((r: any) => (
              <div
                key={r.id}
                onClick={() => navigate("custDetail", { customerId: r.id })}
                className="p-3 md:p-3.5 px-3.5 md:px-[18px] bg-card border border-border rounded-lg shadow-card hover:border-primary hover:shadow-card-hover transition-all cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <div className="w-[34px] h-[34px] md:w-[38px] md:h-[38px] rounded-[10px] bg-warning-muted flex items-center justify-center text-base flex-shrink-0">🔔</div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[13px] md:text-[13.5px] font-bold truncate">{r.name}</h4>
                    <p className="text-[11px] md:text-[12px] text-secondary-foreground truncate">
                      Laatste reiniging: {format(new Date(r.lastServiceDate), "dd-MM-yyyy")} · {r.city || "Onbekend"} · Interval: {r.interval_months} mnd
                    </p>
                    <div className="flex gap-1.5 mt-2 md:hidden">
                      <button onClick={(e) => e.stopPropagation()} className="px-2.5 py-1 bg-accent text-accent-foreground rounded-sm text-[11px] font-bold hover:bg-accent-hover transition-colors">💬 WhatsApp</button>
                      <button onClick={(e) => e.stopPropagation()} className="px-2.5 py-1 bg-card border border-border rounded-sm text-[11px] font-bold text-secondary-foreground hover:bg-bg-hover transition-colors">📧 Mail</button>
                    </div>
                  </div>
                  <div className="hidden md:flex gap-1.5 flex-shrink-0">
                    <button onClick={(e) => e.stopPropagation()} className="px-3 py-1 bg-accent text-accent-foreground rounded-sm text-[12px] font-bold hover:bg-accent-hover transition-colors">💬 WhatsApp</button>
                    <button onClick={(e) => e.stopPropagation()} className="px-3 py-1 bg-card border border-border rounded-sm text-[12px] font-bold text-secondary-foreground hover:bg-bg-hover transition-colors">📧 Mail</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : activeTab === 1 ? (
        logsLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !sendLogs?.length ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            Nog geen herinneringen verstuurd.
          </div>
        ) : (
          <div className="space-y-2.5">
            {sendLogs.map((log: any) => (
              <div key={log.id} className="p-3 md:p-3.5 px-3.5 md:px-[18px] bg-card border border-border rounded-lg shadow-card">
                <div className="flex items-center gap-3">
                  <div className="w-[34px] h-[34px] rounded-[10px] bg-success-muted flex items-center justify-center text-base flex-shrink-0">✅</div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[13px] font-bold truncate">{(log as any).customers?.name ?? "Klant"}</h4>
                    <p className="text-[11px] text-secondary-foreground">
                      {(log as any).whatsapp_automations?.name ?? "Automatisering"} · {format(new Date(log.sent_at), "dd-MM-yyyy HH:mm")}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${log.result?.success ? "bg-success-muted text-success" : "bg-destructive/10 text-destructive"}`}>
                    {log.result?.success ? "Verzonden" : "Mislukt"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="text-center py-16 text-muted-foreground text-sm">
          Nog geen items op dit tabblad.
        </div>
      )}
    </div>
  );
};

export default RemindersPage;
