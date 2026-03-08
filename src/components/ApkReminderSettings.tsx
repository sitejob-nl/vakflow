import { useState } from "react";
import { useApkReminderSettings, useUpsertApkReminderSettings, useApkReminderLogs, useRunApkReminderScan } from "@/hooks/useApkReminders";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Car, Play, Mail, MessageSquare, Info } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

const DAYS_OPTIONS = [
  { value: 60, label: "60 dagen" },
  { value: 30, label: "30 dagen" },
  { value: 14, label: "14 dagen" },
  { value: 7, label: "7 dagen" },
  { value: 3, label: "3 dagen" },
  { value: 1, label: "1 dag" },
];

interface Props {
  inputClass: string;
  labelClass: string;
}

const ApkReminderSettings = ({ inputClass, labelClass }: Props) => {
  const { toast } = useToast();
  const { data: settings, isLoading } = useApkReminderSettings();
  const upsert = useUpsertApkReminderSettings();
  const { data: logs } = useApkReminderLogs(15);
  const runScan = useRunApkReminderScan();

  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [channel, setChannel] = useState<string | null>(null);
  const [daysBefore, setDaysBefore] = useState<number[] | null>(null);
  const [emailSubject, setEmailSubject] = useState<string | null>(null);
  const [emailBody, setEmailBody] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Use local state if set, otherwise fall back to DB
  const currentEnabled = enabled ?? settings?.enabled ?? true;
  const currentChannel = channel ?? settings?.channel ?? "email";
  const currentDays = daysBefore ?? settings?.days_before ?? [30, 14, 7];
  const currentSubject = emailSubject ?? settings?.email_subject ?? "Uw APK verloopt binnenkort";
  const currentBody = emailBody ?? settings?.email_body ?? "Beste {{klantnaam}}, de APK van uw voertuig {{kenteken}} verloopt op {{apk_datum}}. Neem contact met ons op om een afspraak te maken.";

  const handleSave = async () => {
    setSaving(true);
    try {
      await upsert.mutateAsync({
        enabled: currentEnabled,
        channel: currentChannel,
        days_before: currentDays,
        email_subject: currentSubject,
        email_body: currentBody,
      });
      toast({ title: "APK-herinneringen opgeslagen" });
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const toggleDay = (day: number) => {
    const current = [...currentDays];
    const idx = current.indexOf(day);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(day);
      current.sort((a, b) => b - a);
    }
    setDaysBefore(current);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-[14px] font-bold mb-1 flex items-center gap-2">
          <Car className="h-4 w-4" /> APK-herinneringen
        </h3>
        <p className="text-[12px] text-muted-foreground">
          Stuur automatisch herinneringen naar klanten wanneer de APK van hun voertuig bijna verloopt.
        </p>
      </div>

      {/* Enable/disable toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Herinneringen inschakelen</p>
          <p className="text-[11px] text-muted-foreground">Dagelijkse scan naar verlopen APK-datums</p>
        </div>
        <Switch checked={currentEnabled} onCheckedChange={(v) => setEnabled(v)} />
      </div>

      {currentEnabled && (
        <>
          {/* Channel selection */}
          <div>
            <label className={labelClass}>Verzendkanaal</label>
            <Select value={currentChannel} onValueChange={(v) => setChannel(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">
                  <span className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> E-mail</span>
                </SelectItem>
                <SelectItem value="whatsapp">
                  <span className="flex items-center gap-2"><MessageSquare className="h-3.5 w-3.5" /> WhatsApp</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Days before selection */}
          <div>
            <label className={labelClass}>Herinneringsmomenten</label>
            <p className="text-[11px] text-muted-foreground mb-2">Kies op welke momenten vóór de APK-vervaldatum een herinnering wordt verstuurd.</p>
            <div className="flex flex-wrap gap-2">
              {DAYS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleDay(opt.value)}
                  className={`px-3 py-1.5 rounded-md text-[12px] font-medium border transition-colors ${
                    currentDays.includes(opt.value)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Email template */}
          {currentChannel === "email" && (
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Onderwerp</label>
                <input
                  value={currentSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className={inputClass}
                  placeholder="Uw APK verloopt binnenkort"
                />
              </div>
              <div>
                <label className={labelClass}>Berichttekst</label>
                <textarea
                  value={currentBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  className={`${inputClass} min-h-[100px] resize-y`}
                  rows={4}
                />
              </div>
              <div className="bg-muted/50 border border-border rounded-md p-3">
                <div className="flex items-start gap-2">
                  <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-[11px] text-muted-foreground">
                    Beschikbare variabelen: <code className="bg-muted px-1 rounded">{"{{klantnaam}}"}</code> <code className="bg-muted px-1 rounded">{"{{kenteken}}"}</code> <code className="bg-muted px-1 rounded">{"{{apk_datum}}"}</code> <code className="bg-muted px-1 rounded">{"{{dagen}}"}</code>
                  </p>
                </div>
              </div>
            </div>
          )}

          {currentChannel === "whatsapp" && (
            <div className="bg-muted/50 border border-border rounded-md p-3">
              <p className="text-[11px] text-muted-foreground">
                WhatsApp-berichten worden verstuurd als vrij bericht met dezelfde berichttekst. Klanten moeten WhatsApp opt-in hebben.
              </p>
            </div>
          )}
        </>
      )}

      {/* Save + Run buttons */}
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving} className="text-[13px]">
          {saving ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Opslaan...</> : "Opslaan"}
        </Button>
        {currentEnabled && settings && (
          <Button
            variant="outline"
            onClick={async () => {
              try {
                const result = await runScan.mutateAsync();
                toast({
                  title: `Scan voltooid`,
                  description: `${result?.sent || 0} herinnering(en) verstuurd`,
                });
              } catch (err: any) {
                toast({ title: "Fout", description: err.message, variant: "destructive" });
              }
            }}
            disabled={runScan.isPending}
            className="text-[13px] gap-1.5"
          >
            {runScan.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Nu scannen
          </Button>
        )}
      </div>

      {/* Recent logs */}
      {logs && logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent verstuurde herinneringen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between py-1.5 text-sm border-b border-border last:border-b-0">
                  <div className="flex items-center gap-2">
                    {log.channel === "email" ? <Mail className="h-3.5 w-3.5 text-muted-foreground" /> : <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />}
                    <span className="text-muted-foreground text-xs">
                      {format(new Date(log.sent_at), "dd MMM yyyy HH:mm", { locale: nl })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">{log.reminder_type}</Badge>
                    <span className="text-xs text-muted-foreground">APK: {log.apk_expiry_date}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ApkReminderSettings;
