import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff, Copy, Check, Wifi, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  click_to_dial_enabled: boolean;
  voipgrid_api_url: string;
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
  click_to_dial_enabled: false,
  voipgrid_api_url: "https://partner.voipgrid.nl",
};

const VOYS_EVENTS = [
  { event: "created", description: "Gesprek gestart, call record aangemaakt" },
  { event: "ringing", description: "Telefoon rinkelt" },
  { event: "in-progress", description: "Gesprek beantwoord, opgenomen door wordt vastgelegd" },
  { event: "ended", description: "Gesprek beëindigd, transcriptie + samenvatting worden opgehaald" },
  { event: "warm-transfer", description: "Gesprek warm doorgeschakeld" },
  { event: "cold-transfer", description: "Gesprek koud doorgeschakeld" },
];

const SettingsVoysTab = () => {
  const { companyId } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [copiedUniversal, setCopiedUniversal] = useState(false);
  const [copiedTenant, setCopiedTenant] = useState(false);
  const [form, setForm] = useState<VoysForm>(DEFAULT);
  const [phoneInput, setPhoneInput] = useState("");

  const webhookUrlUniversal = `${SUPABASE_URL}/functions/v1/voys-webhook`;
  const webhookUrlTenant = `${SUPABASE_URL}/functions/v1/voys-webhook?company_id=${companyId || ""}`;

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
          click_to_dial_enabled: data.click_to_dial_enabled ?? false,
          voipgrid_api_url: data.voipgrid_api_url || "https://partner.voipgrid.nl",
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
      click_to_dial_enabled: form.click_to_dial_enabled,
      voipgrid_api_url: form.voipgrid_api_url || "https://partner.voipgrid.nl",
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
    setTestResult(null);
    const errors: string[] = [];

    // Test 1: Check required fields
    if (!form.client_uuid || !form.api_token) {
      setTestResult({ ok: false, message: "Client UUID en API Token zijn verplicht" });
      setTesting(false);
      return;
    }

    // Test 2: Test transcription API reachability
    try {
      const res = await supabase.functions.invoke("voys-webhook" as any, {
        body: { action: "test-connection" },
      });
      if (res.error) {
        errors.push(`Webhook test: ${res.error.message}`);
      } else if (!res.data?.success) {
        errors.push(res.data?.error || "Webhook test mislukt");
      }
    } catch (err: any) {
      errors.push(`Webhook: ${err.message}`);
    }

    // Test 3: Test Holodeck transcription API
    try {
      const transcriptionUrl = `https://holodeck.voys.nl/transcription-storage/clients/${form.client_uuid}/calls/test/transcriptions`;
      const transcriptionRes = await fetch(transcriptionUrl, {
        headers: { Authorization: `Bearer ${form.api_token}` },
      });
      // 401 = token works but no call found, 404 = endpoint exists
      if (transcriptionRes.status === 401 || transcriptionRes.status === 404 || transcriptionRes.ok) {
        // OK — API is reachable
      } else {
        errors.push(`Transcriptie API: HTTP ${transcriptionRes.status}`);
      }
    } catch (err: any) {
      errors.push(`Transcriptie API niet bereikbaar: ${err.message}`);
    }

    const newStatus = errors.length === 0 ? "active" : "error";
    setForm(prev => ({ ...prev, status: newStatus }));
    if (form.id) {
      await supabase.from("voys_config" as any).update({ status: newStatus }).eq("id", form.id);
    }

    if (errors.length === 0) {
      setTestResult({ ok: true, message: "Verbinding OK — Webhook en Transcriptie API bereikbaar" });
      toast({ title: "Verbinding succesvol" });
    } else {
      setTestResult({ ok: false, message: `Verbinding mislukt: ${errors.join("; ")}` });
      toast({ title: "Verbinding mislukt", description: errors.join("; "), variant: "destructive" });
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

  const copyUrl = (url: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(url);
    setter(true);
    setTimeout(() => setter(false), 2000);
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
          <div className="flex items-center gap-3">
            <Button size="sm" variant="outline" onClick={handleTest} disabled={testing || !form.client_uuid || !form.api_token}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Wifi className="h-4 w-4 mr-1" />}
              Test verbinding
            </Button>
            {testResult && (
              <span className={`text-[12px] font-medium ${testResult.ok ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                {testResult.message}
              </span>
            )}
          </div>
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

      {/* Klik-en-Bel */}
      <div className="border-t border-border pt-5">
        <h3 className="text-[14px] font-bold mb-3">Klik-en-Bel</h3>
        <div className="space-y-4">
          <ToggleRow
            label="Klik-en-bel inschakelen"
            description="Bel klanten direct vanuit het platform. Je telefoon gaat eerst over, daarna wordt de klant gebeld."
            checked={form.click_to_dial_enabled}
            onChange={v => setForm(prev => ({ ...prev, click_to_dial_enabled: v }))}
          />
          {form.click_to_dial_enabled && (
            <div>
              <label className={labelClass}>VoIPGRID API URL</label>
              <input
                value={form.voipgrid_api_url}
                onChange={e => setForm(prev => ({ ...prev, voipgrid_api_url: e.target.value }))}
                className={inputClass}
                placeholder="https://partner.voipgrid.nl"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Standaard hoef je dit niet aan te passen.</p>
            </div>
          )}
        </div>
      </div>

      {/* Webhook */}
      <div className="border-t border-border pt-5">
        <h3 className="text-[14px] font-bold mb-3">Webhook</h3>
        <p className="text-[11px] text-muted-foreground mb-3">
          Configureer één van deze URLs als 'Gespreksnotificatie URL' in je Voys portaal onder Beheer → Gespreksnotificaties. De tenant-specifieke URL wordt aanbevolen als je meerdere bedrijven hebt.
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Universeel</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted rounded-md px-3 py-2 text-[12px] font-mono break-all">{webhookUrlUniversal}</code>
              <Button size="sm" variant="outline" onClick={() => copyUrl(webhookUrlUniversal, setCopiedUniversal)}>
                {copiedUniversal ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
              Tenant-specifiek <Badge variant="secondary" className="text-[9px] ml-1">Aanbevolen</Badge>
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted rounded-md px-3 py-2 text-[12px] font-mono break-all">{webhookUrlTenant}</code>
              <Button size="sm" variant="outline" onClick={() => copyUrl(webhookUrlTenant, setCopiedTenant)}>
                {copiedTenant ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Voys Events */}
      <div className="border-t border-border pt-5">
        <h3 className="text-[14px] font-bold mb-3">Voys Events</h3>
        <p className="text-[11px] text-muted-foreground mb-3">Overzicht van de webhook events die automatisch worden verwerkt</p>
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[11px] font-bold w-[140px]">Event</TableHead>
                <TableHead className="text-[11px] font-bold">Wat er gebeurt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {VOYS_EVENTS.map((e) => (
                <TableRow key={e.event}>
                  <TableCell className="font-mono text-[12px]">{e.event}</TableCell>
                  <TableCell className="text-[12px] text-muted-foreground">{e.description}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">
          Meer info over gespreksnotificaties op{" "}
          <a
            href="https://wiki.voys.nl"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-0.5"
          >
            wiki.voys.nl <ExternalLink className="h-3 w-3" />
          </a>
        </p>
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
