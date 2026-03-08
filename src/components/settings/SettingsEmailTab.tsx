import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check } from "lucide-react";
import { SETTINGS_INPUT_CLASS as inputClass, SETTINGS_LABEL_CLASS as labelClass } from "./shared";

const SettingsEmailTab = () => {
  const { companyId } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [emailProvider, setEmailProvider] = useState("smtp");
  const [form, setForm] = useState({
    smtp_host: "", smtp_port: "465", smtp_email: "",
    imap_host: "", imap_port: "993",
    outlook_email: "",
  });
  const [hasPassword, setHasPassword] = useState(false);
  const [smtpPassword, setSmtpPassword] = useState("");
  const [connectingOutlook, setConnectingOutlook] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const { data } = await supabase.from("companies_safe" as any).select(
        "email_provider, smtp_host, smtp_port, smtp_email, outlook_email"
      ).eq("id", companyId).single() as { data: any };
      if (data) {
        setEmailProvider(data.email_provider ?? "smtp");
        setForm({
          smtp_host: data.smtp_host ?? "smtp.transip.email",
          smtp_port: String(data.smtp_port ?? 465),
          smtp_email: data.smtp_email ?? "",
          imap_host: "", imap_port: "993",
          outlook_email: data.outlook_email ?? "",
        });
      }
      setLoading(false);
    })();
  }, [companyId]);

  const handleSave = async () => {
    if (!companyId) return;
    setSaving(true);
    const updates: Record<string, any> = {
      email_provider: emailProvider,
      smtp_host: form.smtp_host || null,
      smtp_port: parseInt(form.smtp_port) || 465,
      smtp_email: form.smtp_email || null,
    };
    const { error } = await supabase.from("companies").update(updates).eq("id", companyId);
    setSaving(false);
    toast(error ? { title: "Fout", description: error.message, variant: "destructive" } : { title: "E-mailinstellingen opgeslagen" });
  };

  const handleSavePassword = async () => {
    if (!companyId || !smtpPassword) return;
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("save-smtp-credentials", {
      body: { company_id: companyId, field: "smtp_password", value: smtpPassword },
    });
    setSaving(false);
    if (error || data?.error) {
      toast({ title: "Fout", description: data?.error || error?.message, variant: "destructive" });
    } else {
      setHasPassword(true);
      setSmtpPassword("");
      toast({ title: "SMTP-wachtwoord opgeslagen" });
    }
  };

  const handleConnectOutlook = async () => {
    setConnectingOutlook(true);
    try {
      const { data, error } = await supabase.functions.invoke("outlook-auth-url", { body: { scope: "company" } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      window.open(data.url, "outlook-company-auth", "width=600,height=700");
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
    setConnectingOutlook(false);
  };

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data === "outlook-company-connected") {
        toast({ title: "Outlook gekoppeld!" });
        window.location.reload();
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const field = (label: string, key: keyof typeof form, placeholder = "", type = "text") => (
    <div>
      <label className={labelClass}>{label}</label>
      <input type={type} value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} className={inputClass} placeholder={placeholder} />
    </div>
  );

  return (
    <div className="bg-card border border-border rounded-lg shadow-card p-5 md:p-6 space-y-5">
      {/* Provider toggle */}
      <div>
        <label className={labelClass}>E-mailprovider</label>
        <div className="flex gap-2">
          {["smtp", "outlook"].map((p) => (
            <button key={p} onClick={() => setEmailProvider(p)} className={`px-4 py-2 rounded-sm text-[12px] font-bold transition-colors ${emailProvider === p ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}>
              {p === "smtp" ? "SMTP" : "Microsoft Outlook"}
            </button>
          ))}
        </div>
      </div>

      {emailProvider === "smtp" && (
        <div className="border-t border-border pt-5 space-y-3">
          <h3 className="text-[14px] font-bold">SMTP-instellingen</h3>
          <div className="grid grid-cols-2 gap-3">
            {field("SMTP Host", "smtp_host", "smtp.transip.email")}
            {field("SMTP Poort", "smtp_port", "465")}
          </div>
          {field("E-mailadres", "smtp_email", "info@uwbedrijf.nl")}
          <div>
            <label className={labelClass}>Wachtwoord</label>
            <div className="flex gap-2">
              <input type="password" value={smtpPassword} onChange={(e) => setSmtpPassword(e.target.value)} className={inputClass} placeholder={hasPassword ? "••••••••" : "SMTP wachtwoord"} />
              <button onClick={handleSavePassword} disabled={saving || !smtpPassword} className="px-3 py-2 bg-primary text-primary-foreground rounded-sm text-[12px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50 whitespace-nowrap">
                Opslaan
              </button>
            </div>
            {hasPassword && <p className="text-[11px] text-success mt-1 flex items-center gap-1"><Check className="h-3 w-3" /> Wachtwoord ingesteld</p>}
          </div>
        </div>
      )}

      {emailProvider === "outlook" && (
        <div className="border-t border-border pt-5 space-y-3">
          <h3 className="text-[14px] font-bold">Microsoft Outlook</h3>
          <p className="text-[13px] text-muted-foreground">Koppel Outlook om e-mail te versturen en te ontvangen via Microsoft Graph API.</p>
          {form.outlook_email ? (
            <div>
              <p className="text-[11px] text-success font-bold flex items-center gap-1"><Check className="h-3 w-3" /> Gekoppeld — {form.outlook_email}</p>
              <button onClick={handleConnectOutlook} disabled={connectingOutlook} className="mt-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-sm text-[12px] font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50">
                Opnieuw koppelen
              </button>
            </div>
          ) : (
            <button onClick={handleConnectOutlook} disabled={connectingOutlook} className="px-5 py-2.5 bg-primary text-primary-foreground rounded-sm text-[13px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50">
              {connectingOutlook ? "Bezig..." : "Koppel Outlook"}
            </button>
          )}
        </div>
      )}

      {emailProvider === "smtp" && (
        <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 bg-primary text-primary-foreground rounded-sm text-[13px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50">
          {saving ? "Opslaan..." : "Opslaan"}
        </button>
      )}
    </div>
  );
};

export default SettingsEmailTab;
