import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff, Copy, Check, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { SETTINGS_INPUT_CLASS as inputClass, SETTINGS_LABEL_CLASS as labelClass } from "./shared";

const SUPABASE_URL = "https://sigzpqwnavfxtvbyqvzj.supabase.co";

const PORTALS = [
  { code: "marktplaats", label: "Marktplaats" },
  { code: "autoscout24", label: "AutoScout24" },
  { code: "autotrack", label: "AutoTrack" },
  { code: "gaspedaal", label: "Gaspedaal" },
  { code: "autoweek", label: "AutoWeek" },
  { code: "facebook_marketplace", label: "Facebook Marketplace" },
  { code: "autowereld", label: "AutoWereld" },
] as const;

interface HexonConfig {
  id?: string;
  api_url: string;
  api_key: string;
  publication: string;
  status: string;
  default_site_codes: string[];
  auto_publish: boolean;
  photo_overlay_code: string;
}

const DEFAULT: HexonConfig = {
  api_url: "https://api.hexon.nl/spi/api",
  api_key: "",
  publication: "",
  status: "pending",
  default_site_codes: [],
  auto_publish: false,
  photo_overlay_code: "",
};

const SettingsHexonTab = () => {
  const { companyId } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState<HexonConfig>(DEFAULT);

  const webhookUrl = `${SUPABASE_URL}/functions/v1/hexon-webhook`;

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const { data } = await supabase
        .from("hexon_config" as any)
        .select("*")
        .eq("company_id", companyId)
        .single() as { data: any };
      if (data) {
        setForm({
          id: data.id,
          api_url: data.api_url || DEFAULT.api_url,
          api_key: data.api_key || "",
          publication: data.publication || "",
          status: data.status || "pending",
          default_site_codes: data.default_site_codes || [],
          auto_publish: data.auto_publish ?? false,
          photo_overlay_code: data.photo_overlay_code || "",
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
      api_url: form.api_url,
      api_key: form.api_key || null,
      publication: form.publication || null,
      default_site_codes: form.default_site_codes,
      auto_publish: form.auto_publish,
      photo_overlay_code: form.photo_overlay_code || null,
      updated_at: new Date().toISOString(),
    };

    let error: any;
    if (form.id) {
      ({ error } = await supabase
        .from("hexon_config" as any)
        .update(payload)
        .eq("id", form.id));
    } else {
      const { data, error: insertError } = await supabase
        .from("hexon_config" as any)
        .insert(payload)
        .select("id")
        .single() as { data: any; error: any };
      error = insertError;
      if (data) setForm(prev => ({ ...prev, id: data.id }));
    }

    setSaving(false);
    toast(error
      ? { title: "Fout", description: error.message, variant: "destructive" }
      : { title: "Hexon instellingen opgeslagen" });
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("hexon-sync" as any, {
        body: { action: "test-connection" },
      });
      if (error) throw error;
      const newStatus = data?.success ? "active" : "error";
      setForm(prev => ({ ...prev, status: newStatus }));
      // Update status in DB
      if (form.id) {
        await supabase.from("hexon_config" as any).update({ status: newStatus }).eq("id", form.id);
      }
      toast(data?.success
        ? { title: "Verbinding succesvol" }
        : { title: "Verbinding mislukt", description: data?.error || "Geen antwoord van Hexon API", variant: "destructive" });
    } catch (err: any) {
      setForm(prev => ({ ...prev, status: "error" }));
      toast({ title: "Test mislukt", description: err.message, variant: "destructive" });
    }
    setTesting(false);
  };

  const toggleSiteCode = (code: string) => {
    setForm(prev => ({
      ...prev,
      default_site_codes: prev.default_site_codes.includes(code)
        ? prev.default_site_codes.filter(c => c !== code)
        : [...prev.default_site_codes, code],
    }));
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
      {/* API Verbinding */}
      <div>
        <h3 className="text-[14px] font-bold mb-3 flex items-center gap-2">
          API Verbinding
          <span className={`h-2 w-2 rounded-full ${statusColor}`} />
          <Badge variant="outline" className="text-[10px]">{statusLabel}</Badge>
        </h3>
        <div className="space-y-3">
          <div>
            <label className={labelClass}>API URL</label>
            <input
              value={form.api_url}
              onChange={e => setForm(prev => ({ ...prev, api_url: e.target.value }))}
              className={inputClass}
              placeholder="https://api.hexon.nl/spi/api"
            />
            <p className="text-[11px] text-muted-foreground mt-1">Standaard Hexon API URL — meestal niet aanpassen</p>
          </div>
          <div>
            <label className={labelClass}>API Key</label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={form.api_key}
                onChange={e => setForm(prev => ({ ...prev, api_key: e.target.value }))}
                className={`${inputClass} pr-10`}
                placeholder="Hexon API sleutel"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className={labelClass}>Publicatie code</label>
            <input
              value={form.publication}
              onChange={e => setForm(prev => ({ ...prev, publication: e.target.value }))}
              className={inputClass}
              placeholder="Bijv. mijngarage"
            />
            <p className="text-[11px] text-muted-foreground mt-1">Je publicatienaam bij Hexon, ontvangen bij registratie</p>
          </div>
          <Button size="sm" variant="outline" onClick={handleTest} disabled={testing || !form.api_key}>
            {testing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Wifi className="h-4 w-4 mr-1" />}
            Test verbinding
          </Button>
        </div>
      </div>

      {/* Portalen */}
      <div className="border-t border-border pt-5">
        <h3 className="text-[14px] font-bold mb-3">Portalen</h3>
        <p className="text-[11px] text-muted-foreground mb-3">Geselecteerde portalen worden standaard gebruikt bij publicatie van voertuigen</p>
        <div className="grid grid-cols-2 gap-2">
          {PORTALS.map(p => (
            <label key={p.code} className="flex items-center gap-2 text-[13px] cursor-pointer p-2 rounded-md hover:bg-muted/50 transition-colors">
              <Checkbox
                checked={form.default_site_codes.includes(p.code)}
                onCheckedChange={() => toggleSiteCode(p.code)}
              />
              <span className="font-medium">{p.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Automatisering */}
      <div className="border-t border-border pt-5">
        <h3 className="text-[14px] font-bold mb-3">Automatisering</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium">Automatisch publiceren</p>
              <p className="text-[11px] text-muted-foreground">Publiceer voertuigen automatisch wanneer status &apos;foto_klaar&apos; of &apos;online&apos; wordt</p>
            </div>
            <Switch
              checked={form.auto_publish}
              onCheckedChange={v => setForm(prev => ({ ...prev, auto_publish: v }))}
            />
          </div>
          <div>
            <label className={labelClass}>Foto overlay code</label>
            <input
              value={form.photo_overlay_code}
              onChange={e => setForm(prev => ({ ...prev, photo_overlay_code: e.target.value }))}
              className={inputClass}
              placeholder="Watermark overlay code"
            />
            <p className="text-[11px] text-muted-foreground mt-1">Watermark overlay code van Hexon</p>
          </div>
        </div>
      </div>

      {/* Webhook */}
      <div className="border-t border-border pt-5">
        <h3 className="text-[14px] font-bold mb-3">Webhook</h3>
        <p className="text-[11px] text-muted-foreground mb-2">Configureer deze URL als webhook in je Hexon account:</p>
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

export default SettingsHexonTab;
