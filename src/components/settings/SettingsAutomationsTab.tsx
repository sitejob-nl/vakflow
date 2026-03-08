import { useState } from "react";
import { useAutoMessageSettings, useUpsertAutoMessageSetting, MESSAGE_TYPES, LABELS, type MessageType } from "@/hooks/useAutoMessageSettings";
import { useWhatsAppTemplates } from "@/hooks/useWhatsAppTemplates";
import { useEmailTemplates } from "@/hooks/useEmailTemplates";
import { useWhatsAppStatus } from "@/hooks/useWhatsAppStatus";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { SETTINGS_INPUT_CLASS as inputClass, SETTINGS_LABEL_CLASS as labelClass } from "./shared";

const CHANNEL_OPTIONS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "E-mail" },
  { value: "both", label: "Beide" },
] as const;

const SettingsAutomationsTab = () => {
  const { data: settings, isLoading } = useAutoMessageSettings();
  const upsert = useUpsertAutoMessageSetting();
  const { data: waStatus } = useWhatsAppStatus();
  const { data: waTemplates } = useWhatsAppTemplates(!!waStatus?.connected);
  const { data: emailTemplates } = useEmailTemplates();
  const { toast } = useToast();

  const [savingType, setSavingType] = useState<string | null>(null);

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const handleToggle = async (setting: any) => {
    setSavingType(setting.message_type);
    try {
      await upsert.mutateAsync({
        message_type: setting.message_type,
        enabled: !setting.enabled,
        channel: setting.channel,
        template_name: setting.template_name,
        custom_text: setting.custom_text,
        delay_hours: setting.delay_hours,
        email_template_id: setting.email_template_id,
      });
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
    setSavingType(null);
  };

  const handleUpdate = async (setting: any, field: string, value: any) => {
    setSavingType(setting.message_type);
    try {
      await upsert.mutateAsync({
        message_type: setting.message_type,
        enabled: setting.enabled,
        channel: field === "channel" ? value : setting.channel,
        template_name: field === "template_name" ? value : setting.template_name,
        custom_text: setting.custom_text,
        delay_hours: field === "delay_hours" ? parseInt(value) || 0 : setting.delay_hours,
        email_template_id: field === "email_template_id" ? value || null : setting.email_template_id,
      });
      toast({ title: "Automatisering bijgewerkt" });
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
    setSavingType(null);
  };

  const approvedTemplates = (waTemplates ?? []).filter((t) => t.status === "APPROVED");

  return (
    <div className="bg-card border border-border rounded-lg shadow-card p-5 md:p-6 space-y-4">
      <h3 className="text-[14px] font-bold">Automatische berichten</h3>
      <p className="text-[12px] text-muted-foreground">Stel in welke berichten automatisch worden verstuurd na bepaalde acties.</p>

      <div className="space-y-4">
        {(settings ?? []).map((s) => (
          <div key={s.message_type} className="border border-border rounded-sm p-4 bg-background space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-bold">{LABELS[s.message_type as MessageType]}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={s.enabled} onChange={() => handleToggle(s)} className="sr-only peer" disabled={savingType === s.message_type} />
                <div className="w-9 h-5 bg-muted-foreground/30 peer-focus:ring-2 peer-focus:ring-primary/30 rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
              </label>
            </div>

            {s.enabled && (
              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Kanaal</label>
                    <select value={s.channel} onChange={(e) => handleUpdate(s, "channel", e.target.value)} className={inputClass}>
                      {CHANNEL_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Vertraging (uren)</label>
                    <input type="number" min={0} value={s.delay_hours} onChange={(e) => handleUpdate(s, "delay_hours", e.target.value)} className={inputClass} />
                  </div>
                </div>

                {(s.channel === "whatsapp" || s.channel === "both") && (
                  <div>
                    <label className={labelClass}>WhatsApp Template</label>
                    <select value={s.template_name ?? ""} onChange={(e) => handleUpdate(s, "template_name", e.target.value || null)} className={inputClass}>
                      <option value="">— Selecteer template —</option>
                      {approvedTemplates.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
                    </select>
                  </div>
                )}

                {(s.channel === "email" || s.channel === "both") && (
                  <div>
                    <label className={labelClass}>E-mail Template</label>
                    <select value={s.email_template_id ?? ""} onChange={(e) => handleUpdate(s, "email_template_id", e.target.value || null)} className={inputClass}>
                      <option value="">— Selecteer template —</option>
                      {(emailTemplates ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SettingsAutomationsTab;
