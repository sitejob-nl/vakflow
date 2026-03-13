import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff, Copy, Check, Wifi, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { SETTINGS_INPUT_CLASS as inputClass, SETTINGS_LABEL_CLASS as labelClass } from "./shared";

const SUPABASE_URL = "https://sigzpqwnavfxtvbyqvzj.supabase.co";

interface VoysForm {
  id?: string;
  client_uuid: string;
  api_token: string;
  status: string;
  phone_numbers: string[];
  record_calls: boolean;
  transcribe: boolean;
  fetch_summary: boolean;
  enrich_summary: boolean;
  ai_fallback: boolean;
  fallback_delay_seconds: number;
}

const DEFAULT: VoysForm = {
  client_uuid: "",
  api_token: "",
  status: "pending",
  phone_numbers: [],
  record_calls: false,
  transcribe: true,
  fetch_summary: true,
  enrich_summary: true,
  ai_fallback: false,
  fallback_delay_seconds: 20,
};

const SettingsVoysTab = () => {
  const { companyId } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState<VoysForm>(DEFAULT);
  const [phoneInput, setPhoneInput] = useState("");

  const webhookUrl = `${SUPABASE_URL}/functions/v1/voys-webhook`;

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const { data } = await supabase
        .from("voys_config" as any)
        .select("*")
        .eq("company_id", companyId)
        .single() as { data: any };
      if (data) {
        setForm({
          id: data.id,
          client_uuid: data.client_uuid || "",
          api_token: data.api_token || "",
          status: data.status || "pending",
          phone_numbers: data.phone_numbers || [],
          record_calls: data.record_calls ?? false,
          transcribe: data.transcribe ?? true,
          fetch_summary: data.fetch_summary ?? true,
          enrich_summary: data.enrich_summary ?? true,
          ai_fallback: data.ai_fallback ?? false,
          fallback_delay_seconds: data.fallback_delay_seconds ?? 20,
        });
      }
      setLoading(false);
    })();
  }, [companyId]);

  const handleSave = async () => {
    if (!companyId) return;
    setSaving(true);
    const payload: any = {
      company_id: companyId,
      client_uuid: form.client_uuid || null,
      api_token: form.api_token || null,
      phone_numbers: form.phone_numbers,
      record_calls: form.record_calls,
      transcribe: form.transcribe,
      fetch_summary: form.fetch_summary,
      enrich_summary: form.enrich_summary,
      ai_fallback: form.ai_fallback,
      fallback_delay_seconds: form.fallback_delay_seconds,
      updated_at: new Date().toISOString(),
    };

    let error: any;
    if (form.id) {
      ({ error } = await supabase.from("voys_config" as any).update(payload).eq("id", form.id));
    } else {
      const { data, error: insertError } = await supabase
        .from("voys_config" as any)
        .insert(payload)
        .select("id")
        .single() as { data: any; error: any };
      error = insertError;
      if (data) setForm(prev => ({ ...prev, id: data.id }));
    }

    setSaving(false);
    toast(error
      ? { title: "Fout", description: error.message, variant: "destructive" }
      : { title: "Voys instellingen opgeslagen" });
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("voys-webhook" as any, {
        body: { action: "test-connection" },
      });
      if (error) throw error;
      const newStatus = data?.success ? "active" : "error";
      setForm(prev => ({ ...prev, status: newStatus }));
      if (form.id) {
        await supabase.from("voys_config" as any).update({ status: newStatus }).eq("id", form.id);
      }
      toast(data?.success
        ? { title: "Verbinding succesvol" }
        : { title: "Verbinding mislukt", description: data?.error || "Geen antwoord van Voys API", variant: "destructive" });
    } catch (err: any) {
      setForm(prev => ({ ...prev, status: "error" }));
      toast({ title: "Test mislukt", description: err.message, variant: "destructive" });
    }
    setTesting(false);
  };

  const addPhone = () => {
    const cleaned = phoneInput.trim();
    if (cleaned && !form.phone_numbers.includes(cleaned)) {
      setForm(prev => ({ ...prev, phone_numbers: [...prev.phone_numbers, cleaned] }));
      setPhoneInput("");
    }
  };

  const removePhone = (idx: number) => {
    setForm(prev => ({ ...prev, phone_numbers: prev.phone_numbers.filter((_, i) => i !== idx) }));
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const statusColor = form.status === "active" ? "bg-emerald-500" : form.status === "error" ? "bg-destructive" : "bg-amber-500";
  const statusLabel = form.status === "active" ? "Actief" : form.status === "error" ? "Fout" : "Pending";

  return (
    <div className="bg-card border border-border rounded-lg shadow-card p-5 md:p-6 space-y-6">
      {/* Voys Verbinding */}
      <div>
        <h3 className="text-[14px] font-bold mb-3 flex items-center gap-2">
          Voys Verbinding
          <span className={`h-2 w-2 rounded-full ${statusColor}`} />
          <Badge variant="outline" className="text-[10px]">{statusLabel}</Badge>
        </h3>
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Client UUID</label>
            <input
              value={form.client_uuid}
              onChange={e => setForm(prev => ({ ...prev, client_uuid: e.target.value }))}
              className={inputClass}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
            <p className="text-[11px] text-muted-foreground mt-1">Te vinden in je Voys Partners dashboard</p>
          </div>
          <div>
            <label className={labelClass}>API Token</label>
            <div className="relative">
              <input
                type={showToken ? "text" : "password"}
                value={form.api_token}
                onChange={e => setForm(prev => ({ ...prev, api_token: e.target.value }))}
                className={`${inputClass} pr-10`}
                placeholder="Bearer token"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Bearer token uit je persoonlijke instellingen in Voys. Je gebruiker moet admin zijn.</p>
          </div>
          <Button size="sm" variant="outline" onClick={handleTest} disabled={testing || !form.client_uuid || !form.api_token}>
            {testing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Wifi className="h-4 w-4 mr-1" />}
            Test verbinding
          </Button>
        </div>
      </div>

      {/* Telefoonnummers */}
      <div className="border-t border-border pt-5">
        <h3 className="text-[14px] font-bold mb-3">Telefoonnummers</h3>
        <p className="text-[11px] text-muted-foreground mb-3">Telefoonnummers gekoppeld aan dit Voys account</p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {form.phone_numbers.map((num, i) => (
            <Badge key={i} variant="secondary" className="gap-1 text-xs font-mono">
              {num}
              <button onClick={() => removePhone(i)} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={phoneInput}
            onChange={e => setPhoneInput(e.target.value)}
            placeholder="+31 20 1234567"
            className="font-mono text-sm"
            onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addPhone())}
          />
          <Button size="sm" variant="outline" onClick={addPhone} disabled={!phoneInput.trim()}>+</Button>
        </div>
      </div>

      {/* Functies */}
      <div className="border-t border-border pt-5">
        <h3 className="text-[14px] font-bold mb-3">Functies</h3>
        <div className="space-y-4">
          <ToggleRow
            label="Gesprekken opnemen"
            checked={form.record_calls}
            onChange={v => setForm(prev => ({ ...prev, record_calls: v }))}
          />
          <ToggleRow
            label="Transcriptie ophalen"
            description="Voys maakt automatisch een transcriptie van elk gesprek"
            checked={form.transcribe}
            onChange={v => setForm(prev => ({ ...prev, transcribe: v }))}
          />
          <ToggleRow
            label="Samenvatting ophalen"
            description="Voys genereert automatisch een samenvatting"
            checked={form.fetch_summary}
            onChange={v => setForm(prev => ({ ...prev, fetch_summary: v }))}
          />
          <ToggleRow
            label="AI verrijking"
            description="Laat AI actiepunten en CRM-routing extraheren uit de transcriptie. Schrijft verrijkte samenvatting terug naar Voys."
            checked={form.enrich_summary}
            onChange={v => setForm(prev => ({ ...prev, enrich_summary: v }))}
          />
        </div>
      </div>

      {/* AI Terugbellen */}
      <div className="border-t border-border pt-5">
        <h3 className="text-[14px] font-bold mb-3">AI Terugbellen</h3>
        <div className="space-y-4">
          <ToggleRow
            label="AI opvang bij gemiste oproep"
            description="Stuur automatisch een WhatsApp-bericht naar de beller wanneer niemand opneemt"
            checked={form.ai_fallback}
            onChange={v => setForm(prev => ({ ...prev, ai_fallback: v }))}
          />
          {form.ai_fallback && (
            <div>
              <label className={labelClass}>Vertraging (seconden)</label>
              <input
                type="number"
                min={0}
                max={120}
                value={form.fallback_delay_seconds}
                onChange={e => setForm(prev => ({ ...prev, fallback_delay_seconds: parseInt(e.target.value) || 20 }))}
                className={`${inputClass} max-w-[120px]`}
              />
              <p className="text-[11px] text-muted-foreground mt-1">Wacht X seconden na een gemiste oproep voordat de AI-opvolging start</p>
            </div>
          )}
        </div>
      </div>

      {/* Webhook */}
      <div className="border-t border-border pt-5">
        <h3 className="text-[14px] font-bold mb-3">Webhook</h3>
        <p className="text-[11px] text-muted-foreground mb-2">Configureer deze URL als webhook in je Voys/VoIPGRID instellingen</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-muted rounded-md px-3 py-2 text-[12px] font-mono break-all">{webhookUrl}</code>
          <Button size="sm" variant="outline" onClick={copyWebhookUrl}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-5 py-2.5 bg-primary text-primary-foreground rounded-sm text-[13px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50"
      >
        {saving ? "Opslaan..." : "Opslaan"}
      </button>
    </div>
  );
};

const ToggleRow = ({ label, description, checked, onChange }: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) => (
  <div className="flex items-center justify-between">
    <div>
      <p className="text-[13px] font-medium">{label}</p>
      {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
    </div>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);

export default SettingsVoysTab;
