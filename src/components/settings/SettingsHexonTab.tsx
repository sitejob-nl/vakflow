import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff, Copy, Check, Wifi, WifiOff, RefreshCw, CheckCircle2, XCircle, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SETTINGS_INPUT_CLASS as inputClass, SETTINGS_LABEL_CLASS as labelClass } from "./shared";

const SUPABASE_URL = "https://sigzpqwnavfxtvbyqvzj.supabase.co";

interface HexonConfig {
  id?: string;
  api_url: string;
  endpoint: string;
  publication: string;
  auth_method: "basic" | "bearer";
  username: string;
  password: string;
  bearer_token: string;
  default_currency: string;
  incl_vat: boolean;
  vat_pct: number;
  status: string;
  default_site_codes: string[];
  auto_publish: boolean;
  photo_overlay_code: string;
  event_subscription_id: string;
}

const DEFAULT: HexonConfig = {
  api_url: "https://api.hexon.nl",
  endpoint: "",
  publication: "",
  auth_method: "basic",
  username: "",
  password: "",
  bearer_token: "",
  default_currency: "EUR",
  incl_vat: true,
  vat_pct: 21,
  status: "pending",
  default_site_codes: [],
  auto_publish: false,
  photo_overlay_code: "",
  event_subscription_id: "",
};

interface AvailableSite {
  code: string;
  name: string;
}

interface TestResult {
  step: string;
  ok: boolean;
  message: string;
}

/* ── Onboarding Wizard ── */
const OnboardingWizard = ({ companyId, onComplete }: { companyId: string; onComplete: (cfg: HexonConfig) => void }) => {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [hasAccount, setHasAccount] = useState(true);
  const [form, setForm] = useState<HexonConfig>(DEFAULT);
  const [showSecret, setShowSecret] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testOk, setTestOk] = useState<boolean | null>(null);
  const [fetchingSites, setFetchingSites] = useState(false);
  const [availableSites, setAvailableSites] = useState<AvailableSite[]>([]);
  const [registeringWebhook, setRegisteringWebhook] = useState(false);
  const [webhookOk, setWebhookOk] = useState<boolean | null>(null);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestOk(null);
    try {
      const { data, error } = await supabase.functions.invoke("hexon-sync" as any, {
        body: { action: "test-connection" },
      });
      if (error) throw error;
      setTestOk(!!data?.success);
    } catch {
      setTestOk(false);
    }
    setTesting(false);
  };

  const fetchSites = async () => {
    setFetchingSites(true);
    try {
      const { data, error } = await supabase.functions.invoke("hexon-sync" as any, {
        body: { action: "fetch_sites" },
      });
      if (error) throw error;
      setAvailableSites(data?.sites || []);
    } catch {
      toast({ title: "Kan portalen niet ophalen", variant: "destructive" });
    }
    setFetchingSites(false);
  };

  const registerWebhook = async () => {
    setRegisteringWebhook(true);
    setWebhookOk(null);
    try {
      const { data, error } = await supabase.functions.invoke("hexon-sync" as any, {
        body: { action: "setup_webhook" },
      });
      if (error) throw error;
      if (data?.event_subscription_id) {
        setForm(prev => ({ ...prev, event_subscription_id: data.event_subscription_id }));
      }
      setWebhookOk(!!data?.success);
    } catch {
      setWebhookOk(false);
    }
    setRegisteringWebhook(false);
  };

  const saveAndComplete = async () => {
    const payload: any = {
      company_id: companyId,
      api_url: form.api_url,
      endpoint: form.endpoint || null,
      publication: form.publication || null,
      auth_method: form.auth_method,
      username: form.auth_method === "basic" ? form.username : null,
      password: form.auth_method === "basic" ? form.password : null,
      bearer_token: form.auth_method === "bearer" ? form.bearer_token : null,
      default_currency: form.default_currency,
      incl_vat: form.incl_vat,
      vat_pct: form.vat_pct,
      default_site_codes: form.default_site_codes,
      auto_publish: form.auto_publish,
      photo_overlay_code: form.photo_overlay_code || null,
      event_subscription_id: form.event_subscription_id || null,
      status: "active",
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from("hexon_config" as any)
      .insert(payload)
      .select("id")
      .single() as { data: any; error: any };
    if (error) {
      toast({ title: "Fout bij opslaan", description: error.message, variant: "destructive" });
      return;
    }
    onComplete({ ...form, id: data?.id, status: "active" });
  };

  const toggleSiteCode = (code: string) => {
    setForm(prev => ({
      ...prev,
      default_site_codes: prev.default_site_codes.includes(code)
        ? prev.default_site_codes.filter(c => c !== code)
        : [...prev.default_site_codes, code],
    }));
  };

  const steps = ["Welkom", "Gegevens", "Portalen", "Webhook"];

  return (
    <div className="bg-card border border-border rounded-lg shadow-card p-5 md:p-6 space-y-6">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-4">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${i <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className={`text-xs font-medium hidden sm:inline ${i <= step ? "text-foreground" : "text-muted-foreground"}`}>{s}</span>
            {i < steps.length - 1 && <div className="w-6 h-px bg-border" />}
          </div>
        ))}
      </div>

      {/* Step 1: Welkom */}
      {step === 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold">Hexon koppeling instellen</h3>
          <p className="text-sm text-muted-foreground">
            Met de Hexon koppeling publiceer je voertuigen automatisch op portalen zoals Marktplaats, AutoScout24 en meer. 
            Vul je Hexon API-gegevens in om te starten.
          </p>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
            <Checkbox checked={hasAccount} onCheckedChange={(v) => setHasAccount(!!v)} />
            <span className="text-sm">Ik heb al een Hexon account</span>
          </div>
          {!hasAccount && (
            <p className="text-sm text-muted-foreground">
              Neem contact op met <a href="https://hexon.nl" target="_blank" rel="noopener noreferrer" className="text-primary underline">Hexon</a> om een account aan te vragen. Kom terug zodra je je API-gegevens hebt ontvangen.
            </p>
          )}
          <div className="flex justify-end">
            <Button onClick={() => setStep(1)} disabled={!hasAccount}>Volgende</Button>
          </div>
        </div>
      )}

      {/* Step 2: Gegevens */}
      {step === 1 && (
        <div className="space-y-4">
          <h3 className="text-[14px] font-bold">API Gegevens</h3>
          <div className="space-y-3">
            <div>
              <label className={labelClass}>API URL</label>
              <input value={form.api_url} onChange={e => setForm(prev => ({ ...prev, api_url: e.target.value }))} className={inputClass} placeholder="https://api.hexon.nl" />
              <p className="text-[11px] text-muted-foreground mt-1">Gebruik https://api-test.hexon.nl voor sandbox</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Endpoint</label>
                <input value={form.endpoint} onChange={e => setForm(prev => ({ ...prev, endpoint: e.target.value }))} className={inputClass} placeholder="spi" />
              </div>
              <div>
                <label className={labelClass}>Publicatie</label>
                <input value={form.publication} onChange={e => setForm(prev => ({ ...prev, publication: e.target.value }))} className={inputClass} placeholder="demo" />
              </div>
            </div>

            <div>
              <label className={labelClass}>Authenticatie methode</label>
              <RadioGroup value={form.auth_method} onValueChange={(v) => setForm(prev => ({ ...prev, auth_method: v as "basic" | "bearer" }))} className="flex gap-4 mt-1">
                <div className="flex items-center gap-2"><RadioGroupItem value="basic" /><Label className="text-sm">Basic Auth</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="bearer" /><Label className="text-sm">Bearer Token</Label></div>
              </RadioGroup>
            </div>

            {form.auth_method === "basic" ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Gebruikersnaam</label>
                  <input value={form.username} onChange={e => setForm(prev => ({ ...prev, username: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Wachtwoord</label>
                  <div className="relative">
                    <input type={showSecret ? "text" : "password"} value={form.password} onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))} className={`${inputClass} pr-10`} />
                    <button type="button" onClick={() => setShowSecret(!showSecret)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <label className={labelClass}>Bearer Token</label>
                <div className="relative">
                  <input type={showSecret ? "text" : "password"} value={form.bearer_token} onChange={e => setForm(prev => ({ ...prev, bearer_token: e.target.value }))} className={`${inputClass} pr-10`} />
                  <button type="button" onClick={() => setShowSecret(!showSecret)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button size="sm" variant="outline" onClick={handleTestConnection} disabled={testing}>
                {testing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Wifi className="h-4 w-4 mr-1" />}
                Test verbinding
              </Button>
              {testOk === true && <span className="text-emerald-600 text-sm flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> Verbonden</span>}
              {testOk === false && <span className="text-destructive text-sm flex items-center gap-1"><XCircle className="h-4 w-4" /> Mislukt</span>}
            </div>
          </div>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(0)}>Vorige</Button>
            <Button onClick={() => { setStep(2); fetchSites(); }} disabled={testOk !== true}>Volgende</Button>
          </div>
        </div>
      )}

      {/* Step 3: Portalen */}
      {step === 2 && (
        <div className="space-y-4">
          <h3 className="text-[14px] font-bold">Portalen selecteren</h3>
          <p className="text-sm text-muted-foreground">Selecteer de portalen waarop voertuigen standaard gepubliceerd worden.</p>
          {fetchingSites ? (
            <div className="flex items-center gap-2 py-4"><Loader2 className="h-4 w-4 animate-spin" /><span className="text-sm">Portalen ophalen...</span></div>
          ) : availableSites.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {availableSites.map(s => (
                <label key={s.code} className="flex items-center gap-2 text-[13px] cursor-pointer p-2 rounded-md hover:bg-muted/50 transition-colors">
                  <Checkbox checked={form.default_site_codes.includes(s.code)} onCheckedChange={() => toggleSiteCode(s.code)} />
                  <span className="font-medium">{s.name || s.code}</span>
                </label>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground py-4">
              Geen portalen gevonden.
              <Button size="sm" variant="link" onClick={fetchSites} className="ml-1">Opnieuw ophalen</Button>
            </div>
          )}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>Vorige</Button>
            <Button onClick={() => { setStep(3); registerWebhook(); }}>Volgende</Button>
          </div>
        </div>
      )}

      {/* Step 4: Webhook */}
      {step === 3 && (
        <div className="space-y-4">
          <h3 className="text-[14px] font-bold">Webhook registreren</h3>
          <p className="text-sm text-muted-foreground">Hiermee ontvangt Vakflow automatisch updates van Hexon wanneer advertenties wijzigen.</p>
          <div className="flex items-center gap-3 py-4">
            {registeringWebhook ? (
              <><Loader2 className="h-5 w-5 animate-spin text-primary" /><span className="text-sm">Webhook registreren...</span></>
            ) : webhookOk === true ? (
              <><CheckCircle2 className="h-5 w-5 text-emerald-600" /><span className="text-sm text-emerald-700 font-medium">Webhook succesvol geregistreerd</span></>
            ) : webhookOk === false ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2"><XCircle className="h-5 w-5 text-destructive" /><span className="text-sm text-destructive">Webhook registratie mislukt</span></div>
                <Button size="sm" variant="outline" onClick={registerWebhook}>Opnieuw proberen</Button>
              </div>
            ) : null}
          </div>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>Vorige</Button>
            <Button onClick={saveAndComplete}>Afronden</Button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Main Settings Tab ── */
const SettingsHexonTab = () => {
  const { companyId } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState<HexonConfig>(DEFAULT);
  const [fetchingSites, setFetchingSites] = useState(false);
  const [availableSites, setAvailableSites] = useState<AvailableSite[]>([]);
  const [registeringWebhook, setRegisteringWebhook] = useState(false);

  const webhookUrl = `${SUPABASE_URL}/functions/v1/hexon-webhook?company_id=${companyId}`;

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
          endpoint: data.endpoint || "",
          publication: data.publication || "",
          auth_method: data.auth_method || "basic",
          username: data.username || "",
          password: data.password || "",
          bearer_token: data.bearer_token || "",
          default_currency: data.default_currency || "EUR",
          incl_vat: data.incl_vat ?? true,
          vat_pct: data.vat_pct ?? 21,
          status: data.status || "pending",
          default_site_codes: data.default_site_codes || [],
          auto_publish: data.auto_publish ?? false,
          photo_overlay_code: data.photo_overlay_code || "",
          event_subscription_id: data.event_subscription_id || "",
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
      endpoint: form.endpoint || null,
      publication: form.publication || null,
      auth_method: form.auth_method,
      username: form.auth_method === "basic" ? form.username : null,
      password: form.auth_method === "basic" ? form.password : null,
      bearer_token: form.auth_method === "bearer" ? form.bearer_token : null,
      default_currency: form.default_currency,
      incl_vat: form.incl_vat,
      vat_pct: form.vat_pct,
      default_site_codes: form.default_site_codes,
      auto_publish: form.auto_publish,
      photo_overlay_code: form.photo_overlay_code || null,
      event_subscription_id: form.event_subscription_id || null,
      updated_at: new Date().toISOString(),
    };

    let error: any;
    if (form.id) {
      ({ error } = await supabase.from("hexon_config" as any).update(payload).eq("id", form.id));
    } else {
      const { data, error: insertError } = await supabase.from("hexon_config" as any).insert(payload).select("id").single() as { data: any; error: any };
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
    setTestResults([]);
    try {
      const { data, error } = await supabase.functions.invoke("hexon-sync" as any, {
        body: { action: "test-connection" },
      });
      if (error) throw error;
      const results: TestResult[] = [];
      results.push({ step: "Authenticatie", ok: !!data?.auth_ok, message: data?.auth_ok ? "Succesvol" : data?.auth_error || "Authenticatie mislukt (controleer credentials)" });
      results.push({ step: "Portalen ophalen", ok: !!data?.sites_ok, message: data?.sites_ok ? `${data?.sites_count || 0} portalen gevonden` : data?.sites_error || "Kan portalen niet ophalen" });
      setTestResults(results);
      const newStatus = data?.success ? "active" : "error";
      setForm(prev => ({ ...prev, status: newStatus }));
      if (form.id) {
        await supabase.from("hexon_config" as any).update({ status: newStatus }).eq("id", form.id);
      }
    } catch (err: any) {
      setTestResults([{ step: "Verbinding", ok: false, message: err.message || "Netwerk fout" }]);
      setForm(prev => ({ ...prev, status: "error" }));
    }
    setTesting(false);
  };

  const fetchSites = async () => {
    setFetchingSites(true);
    try {
      const { data, error } = await supabase.functions.invoke("hexon-sync" as any, {
        body: { action: "fetch_sites" },
      });
      if (error) throw error;
      setAvailableSites(data?.sites || []);
    } catch {
      toast({ title: "Kan portalen niet ophalen", variant: "destructive" });
    }
    setFetchingSites(false);
  };

  const registerWebhook = async () => {
    setRegisteringWebhook(true);
    try {
      const { data, error } = await supabase.functions.invoke("hexon-sync" as any, {
        body: { action: "setup_webhook" },
      });
      if (error) throw error;
      if (data?.event_subscription_id) {
        setForm(prev => ({ ...prev, event_subscription_id: data.event_subscription_id }));
        if (form.id) {
          await supabase.from("hexon_config" as any).update({ event_subscription_id: data.event_subscription_id }).eq("id", form.id);
        }
      }
      toast({ title: "Webhook geregistreerd" });
    } catch (err: any) {
      toast({ title: "Webhook registratie mislukt", description: err.message, variant: "destructive" });
    }
    setRegisteringWebhook(false);
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

  // Show onboarding wizard if no active config
  if (!form.id || form.status === "pending") {
    return (
      <OnboardingWizard
        companyId={companyId!}
        onComplete={(cfg) => setForm(cfg)}
      />
    );
  }

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
            <input value={form.api_url} onChange={e => setForm(prev => ({ ...prev, api_url: e.target.value }))} className={inputClass} placeholder="https://api.hexon.nl" />
            <p className="text-[11px] text-muted-foreground mt-1">Gebruik https://api-test.hexon.nl voor sandbox</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Endpoint</label>
              <input value={form.endpoint} onChange={e => setForm(prev => ({ ...prev, endpoint: e.target.value }))} className={inputClass} placeholder="spi" />
            </div>
            <div>
              <label className={labelClass}>Publicatie</label>
              <input value={form.publication} onChange={e => setForm(prev => ({ ...prev, publication: e.target.value }))} className={inputClass} placeholder="demo" />
              <p className="text-[11px] text-muted-foreground mt-1">Publicatienaam bij Hexon</p>
            </div>
          </div>
        </div>
      </div>

      {/* Authenticatie */}
      <div className="border-t border-border pt-5">
        <h3 className="text-[14px] font-bold mb-3">Authenticatie</h3>
        <RadioGroup value={form.auth_method} onValueChange={(v) => setForm(prev => ({ ...prev, auth_method: v as "basic" | "bearer" }))} className="flex gap-4 mb-3">
          <div className="flex items-center gap-2"><RadioGroupItem value="basic" /><Label className="text-sm">Basic Auth</Label></div>
          <div className="flex items-center gap-2"><RadioGroupItem value="bearer" /><Label className="text-sm">Bearer Token</Label></div>
        </RadioGroup>
        {form.auth_method === "basic" ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Gebruikersnaam</label>
              <input value={form.username} onChange={e => setForm(prev => ({ ...prev, username: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Wachtwoord</label>
              <div className="relative">
                <input type={showSecret ? "text" : "password"} value={form.password} onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))} className={`${inputClass} pr-10`} />
                <button type="button" onClick={() => setShowSecret(!showSecret)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <label className={labelClass}>Bearer Token</label>
            <div className="relative">
              <input type={showSecret ? "text" : "password"} value={form.bearer_token} onChange={e => setForm(prev => ({ ...prev, bearer_token: e.target.value }))} className={`${inputClass} pr-10`} />
              <button type="button" onClick={() => setShowSecret(!showSecret)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}
        <div className="mt-3">
          <Button size="sm" variant="outline" onClick={handleTest} disabled={testing}>
            {testing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Wifi className="h-4 w-4 mr-1" />}
            Test verbinding
          </Button>
          {testResults.length > 0 && (
            <div className="mt-2 space-y-1">
              {testResults.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  {r.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-destructive" />}
                  <span className="font-medium">{r.step}:</span>
                  <span className={r.ok ? "text-emerald-700" : "text-destructive"}>{r.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Prijzen */}
      <div className="border-t border-border pt-5">
        <h3 className="text-[14px] font-bold mb-3">Prijsinstellingen</h3>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelClass}>Valuta</label>
            <Select value={form.default_currency} onValueChange={v => setForm(prev => ({ ...prev, default_currency: v }))}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="GBP">GBP</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2 pb-0.5">
            <Switch checked={form.incl_vat} onCheckedChange={v => setForm(prev => ({ ...prev, incl_vat: v }))} />
            <Label className="text-sm">Prijzen incl. BTW</Label>
          </div>
          {form.incl_vat && (
            <div>
              <label className={labelClass}>BTW percentage</label>
              <input type="number" value={form.vat_pct} onChange={e => setForm(prev => ({ ...prev, vat_pct: parseFloat(e.target.value) || 0 }))} className={inputClass} min={0} max={100} step={1} />
            </div>
          )}
        </div>
      </div>

      {/* Portalen */}
      <div className="border-t border-border pt-5">
        <h3 className="text-[14px] font-bold mb-3">Portalen</h3>
        <p className="text-[11px] text-muted-foreground mb-3">Geselecteerde portalen worden standaard gebruikt bij publicatie</p>
        <Button size="sm" variant="outline" onClick={fetchSites} disabled={fetchingSites} className="mb-3">
          {fetchingSites ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          Beschikbare portalen ophalen
        </Button>
        {availableSites.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {availableSites.map(s => (
              <label key={s.code} className="flex items-center gap-2 text-[13px] cursor-pointer p-2 rounded-md hover:bg-muted/50 transition-colors">
                <Checkbox checked={form.default_site_codes.includes(s.code)} onCheckedChange={() => toggleSiteCode(s.code)} />
                <span className="font-medium">{s.name || s.code}</span>
              </label>
            ))}
          </div>
        )}
        {availableSites.length === 0 && form.default_site_codes.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {form.default_site_codes.map(code => (
              <label key={code} className="flex items-center gap-2 text-[13px] p-2 rounded-md bg-muted/30">
                <Checkbox checked={true} onCheckedChange={() => toggleSiteCode(code)} />
                <span className="font-medium">{code}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Automatisering */}
      <div className="border-t border-border pt-5">
        <h3 className="text-[14px] font-bold mb-3">Automatisering</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium">Automatisch publiceren</p>
              <p className="text-[11px] text-muted-foreground">Publiceer voertuigen automatisch bij status 'foto_klaar' of 'online'</p>
            </div>
            <Switch checked={form.auto_publish} onCheckedChange={v => setForm(prev => ({ ...prev, auto_publish: v }))} />
          </div>
          <div>
            <label className={labelClass}>Foto overlay code</label>
            <input value={form.photo_overlay_code} onChange={e => setForm(prev => ({ ...prev, photo_overlay_code: e.target.value }))} className={inputClass} placeholder="Watermark overlay code" />
          </div>
        </div>
      </div>

      {/* Webhook */}
      <div className="border-t border-border pt-5">
        <h3 className="text-[14px] font-bold mb-3 flex items-center gap-2">
          Webhook
          {form.event_subscription_id && <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 text-[10px]" variant="outline">Geregistreerd</Badge>}
        </h3>
        <p className="text-[11px] text-muted-foreground mb-2">Webhook URL:</p>
        <div className="flex items-center gap-2 mb-3">
          <code className="flex-1 bg-muted rounded-md px-3 py-2 text-[12px] font-mono break-all">{webhookUrl}</code>
          <Button size="sm" variant="outline" onClick={copyWebhookUrl}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        <Button size="sm" variant="outline" onClick={registerWebhook} disabled={registeringWebhook}>
          {registeringWebhook ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Globe className="h-4 w-4 mr-1" />}
          {form.event_subscription_id ? "Opnieuw registreren" : "Webhook registreren"}
        </Button>
      </div>

      <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 bg-primary text-primary-foreground rounded-sm text-[13px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50">
        {saving ? "Opslaan..." : "Opslaan"}
      </button>
    </div>
  );
};

export default SettingsHexonTab;
