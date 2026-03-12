import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, CheckCircle, Clock, Link2, ExternalLink, Zap } from "lucide-react";
import { useSnelstartConnection, useSaveSnelstartConnection, useDeleteSnelstartConnection, useTestSnelstartConnection } from "@/hooks/useSnelstart";
import { SETTINGS_INPUT_CLASS as inputClass, SETTINGS_LABEL_CLASS as labelClass } from "./shared";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface GlAccount {
  id: string;
  code: string;
  description: string;
}

/* ═══════════════════════════════════════════
   Exact Online Configuration Section
   ═══════════════════════════════════════════ */
const ExactOnlineSection = ({ companyId, saving: parentSaving }: { companyId: string | null; saving: boolean }) => {
  const { toast } = useToast();
  const [exactStatus, setExactStatus] = useState<string | null>(null);
  const [exactCompanyName, setExactCompanyName] = useState<string | null>(null);
  const [loadingExact, setLoadingExact] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [glAccounts, setGlAccounts] = useState<GlAccount[]>([]);
  const [glRevenueId, setGlRevenueId] = useState<string>("");
  const [journalCode, setJournalCode] = useState<string>("70");
  const [loadingGl, setLoadingGl] = useState(false);
  const [savingGl, setSavingGl] = useState(false);
  const [vatCodeHigh, setVatCodeHigh] = useState<string>("VH");
  const [vatCodeLow, setVatCodeLow] = useState<string>("VL");
  const [vatCodeZero, setVatCodeZero] = useState<string>("VN");
  const [invoiceType, setInvoiceType] = useState<number>(8020);
  const [autoFinalize, setAutoFinalize] = useState<boolean>(false);
  const [paymentCondition, setPaymentCondition] = useState<string>("");
  const [defaultItemId, setDefaultItemId] = useState<string>("");
  const [autoConfiguring, setAutoConfiguring] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; issues?: string[] } | null>(null);
  const [polling, setPolling] = useState(false);

  const loadConfig = async () => {
    if (!companyId) return;
    const { data }: { data: any } = await supabase
      .from("exact_config")
      .select("status, company_name_exact, tenant_id, gl_revenue_id, journal_code, vat_code_high, vat_code_low, vat_code_zero, invoice_type, auto_finalize, payment_condition, default_item_id")
      .eq("company_id", companyId)
      .maybeSingle();
    setExactStatus(data?.status ?? null);
    setExactCompanyName(data?.company_name_exact ?? null);
    setGlRevenueId(data?.gl_revenue_id ?? "");
    setJournalCode(data?.journal_code ?? "70");
    setVatCodeHigh(data?.vat_code_high ?? "VH");
    setVatCodeLow(data?.vat_code_low ?? "VL");
    setVatCodeZero(data?.vat_code_zero ?? "VN");
    setInvoiceType(data?.invoice_type ?? 8020);
    setAutoFinalize(data?.auto_finalize ?? false);
    setPaymentCondition(data?.payment_condition ?? "");
    setDefaultItemId(data?.default_item_id ?? "");
    return data?.status;
  };

  useEffect(() => {
    loadConfig().then(() => setLoadingExact(false));
  }, [companyId]);

  useEffect(() => {
    if (exactStatus !== "connected") return;
    setLoadingGl(true);
    supabase.functions.invoke("sync-exact", { body: { action: "fetch-gl-accounts" } })
      .then(({ data, error }) => {
        if (!error && data?.accounts) setGlAccounts(data.accounts);
        setLoadingGl(false);
      });
  }, [exactStatus]);

  // Auto-configure when status becomes connected
  const runAutoConfigure = async () => {
    setAutoConfiguring(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-exact", {
        body: { action: "auto-configure" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      // Reload config to reflect auto-configured values
      await loadConfig();
      toast({
        title: "✓ Configuratie automatisch ingesteld",
        description: `BTW-codes, verkoopboek en grootboekrekening zijn gedetecteerd uit Exact.`,
      });
    } catch (err: any) {
      toast({ title: "Auto-configuratie mislukt", description: err.message, variant: "destructive" });
    } finally {
      setAutoConfiguring(false);
    }
  };

  const runValidateConfig = async () => {
    setValidating(true);
    setValidationResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("sync-exact", {
        body: { action: "validate-config" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setValidationResult({ valid: data.valid, issues: data.issues });
      if (data.valid) {
        toast({ title: "✓ Configuratie is geldig", description: "Alle waarden zijn geverifieerd in Exact." });
      } else {
        toast({ title: "⚠️ Configuratie ongeldig", description: (data.issues || []).join(", "), variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Validatie mislukt", description: err.message, variant: "destructive" });
    } finally {
      setValidating(false);
    }
  };

  const handleSaveGlSettings = async (newGlId?: string, newJournalCode?: string) => {
    if (!companyId) return;
    setSavingGl(true);
    const updates: Record<string, any> = {};
    if (newGlId !== undefined) updates.gl_revenue_id = newGlId || null;
    if (newJournalCode !== undefined) updates.journal_code = newJournalCode || null;
    const { error } = await supabase.from("exact_config").update(updates).eq("company_id", companyId);
    setSavingGl(false);
    if (error) toast({ title: "Fout bij opslaan", description: error.message, variant: "destructive" });
    else toast({ title: "Exact instellingen opgeslagen" });
  };

  const handleSaveExactField = async (field: string, value: any) => {
    if (!companyId) return;
    const { error } = await supabase.from("exact_config").update({ [field]: value }).eq("company_id", companyId);
    if (error) toast({ title: "Fout", description: error.message, variant: "destructive" });
    else toast({ title: "Instelling opgeslagen" });
  };

  const handleConnect = async () => {
    if (!companyId) return;
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("exact-register");
      if (error || data?.error) throw new Error(data?.error || error?.message);
      const tenantId = data?.tenant_id;
      if (!tenantId) throw new Error("Geen tenant_id ontvangen");
      const connectUrl = `https://connect.sitejob.nl/exact-setup?tenant_id=${tenantId}`;
      window.open(connectUrl, "exact-setup", "width=600,height=700");
      setExactStatus("pending");
      toast({ title: "Exact Online koppeling gestart", description: "Rond de autorisatie af in het geopende venster." });

      // Start polling for connection status
      setPolling(true);
      let attempts = 0;
      const maxAttempts = 100; // 5 min at 3s intervals
      const pollInterval = setInterval(async () => {
        attempts++;
        const { data: cfg } = await supabase
          .from("exact_config")
          .select("status")
          .eq("company_id", companyId)
          .maybeSingle();
        if (cfg?.status === "connected") {
          clearInterval(pollInterval);
          setPolling(false);
          await loadConfig();
          // Auto-configure after successful OAuth
          await runAutoConfigure();
        } else if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          setPolling(false);
        }
      }, 3000);
    } catch (err: any) {
      toast({ title: "Fout bij koppelen", description: err.message, variant: "destructive" });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!companyId) return;
    setDisconnecting(true);
    await supabase.from("exact_config").delete().eq("company_id", companyId);
    setExactStatus(null);
    setExactCompanyName(null);
    setValidationResult(null);
    setDisconnecting(false);
    toast({ title: "Exact Online ontkoppeld" });
  };

  const handleRefreshStatus = async () => {
    if (!companyId) return;
    const status = await loadConfig();
    toast({ title: "Status vernieuwd", description: status ?? "Geen configuratie gevonden" });
  };

  if (loadingExact) return <div className="pt-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;

  const isConnected = exactStatus === "connected";
  const isPending = exactStatus === "pending";

  return (
    <div className="space-y-3">
      {isConnected ? (
        <div className="space-y-2">
          <p className="text-[11px] text-success font-bold flex items-center gap-1">
            <Check className="h-3 w-3" /> Exact Online gekoppeld
          </p>
          {exactCompanyName && <p className="text-[12px] text-muted-foreground">Administratie: {exactCompanyName}</p>}
          <div className="flex gap-2 flex-wrap">
            <button onClick={runAutoConfigure} disabled={autoConfiguring} className="px-3 py-2 bg-primary text-primary-foreground rounded-sm text-[12px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center gap-1">
              {autoConfiguring ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
              {autoConfiguring ? "Configureren..." : "Auto-configureren"}
            </button>
            <button onClick={runValidateConfig} disabled={validating} className="px-3 py-2 bg-secondary text-secondary-foreground rounded-sm text-[12px] font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50 flex items-center gap-1">
              {validating ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
              {validating ? "Valideren..." : "Config valideren"}
            </button>
            <button onClick={handleRefreshStatus} className="px-3 py-2 bg-secondary text-secondary-foreground rounded-sm text-[12px] font-medium hover:bg-secondary/80 transition-colors">
              Status vernieuwen
            </button>
            <button onClick={handleDisconnect} disabled={disconnecting} className="px-3 py-2 bg-destructive/10 text-destructive rounded-sm text-[12px] font-medium hover:bg-destructive/20 transition-colors">
              {disconnecting ? "Ontkoppelen..." : "Ontkoppelen"}
            </button>
          </div>

          {validationResult && (
            <div className={`p-3 rounded-lg text-[12px] ${validationResult.valid ? "bg-success-muted text-success" : "bg-destructive/10 text-destructive"}`}>
              {validationResult.valid ? (
                <p className="font-bold flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Configuratie is geldig — klaar om te syncen</p>
              ) : (
                <div>
                  <p className="font-bold mb-1">⚠️ Configuratie ongeldig:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {validationResult.issues?.map((issue, i) => <li key={i}>{issue}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="border-t border-border pt-4 mt-4 space-y-3">
            <h4 className="text-[13px] font-bold">Facturatiekoppeling</h4>
            <div>
              <label className={labelClass}>Omzet-grootboekrekening *</label>
              {loadingGl ? (
                <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Grootboekrekeningen ophalen...
                </div>
              ) : (
                <select value={glRevenueId} onChange={(e) => { setGlRevenueId(e.target.value); handleSaveGlSettings(e.target.value, undefined); }} className={inputClass}>
                  <option value="">— Selecteer grootboekrekening —</option>
                  {glAccounts.map((acc) => (<option key={acc.id} value={acc.id}>{acc.code} — {acc.description}</option>))}
                </select>
              )}
              {!glRevenueId && !loadingGl && <p className="text-[11px] text-destructive mt-1">⚠️ Vereist voor factuur-synchronisatie</p>}
            </div>
            <div>
              <label className={labelClass}>Verkoopjournaal code</label>
              <input value={journalCode} onChange={(e) => setJournalCode(e.target.value)} onBlur={() => handleSaveGlSettings(undefined, journalCode)} className={inputClass} placeholder="70" />
              <p className="text-[11px] text-muted-foreground mt-1">Standaard: 70 (Verkoopboek)</p>
            </div>
            <div>
              <label className={labelClass}>Factuurtype</label>
              <select value={invoiceType} onChange={(e) => { const val = Number(e.target.value); setInvoiceType(val); handleSaveExactField("invoice_type", val); }} className={inputClass}>
                <option value={8020}>8020 — Standaard factuur</option>
                <option value={8023}>8023 — Directe factuur (Advanced editie)</option>
              </select>
              <p className="text-[11px] text-muted-foreground mt-1">Gebruik 8020 tenzij je Exact Advanced/Premium hebt</p>
            </div>
            <div>
              <label className={labelClass}>Betalingsconditie</label>
              <input value={paymentCondition} onChange={(e) => setPaymentCondition(e.target.value)} onBlur={() => handleSaveExactField("payment_condition", paymentCondition || null)} className={inputClass} placeholder="Bijv. 30" />
            </div>
            <div>
              <label className={labelClass}>BTW-codes</label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-[11px] text-muted-foreground mb-1">21% (hoog)</p>
                  <input value={vatCodeHigh} onChange={(e) => setVatCodeHigh(e.target.value)} onBlur={() => handleSaveExactField("vat_code_high", vatCodeHigh)} className={inputClass} placeholder="VH" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground mb-1">9% (laag)</p>
                  <input value={vatCodeLow} onChange={(e) => setVatCodeLow(e.target.value)} onBlur={() => handleSaveExactField("vat_code_low", vatCodeLow)} className={inputClass} placeholder="VL" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground mb-1">0%</p>
                  <input value={vatCodeZero} onChange={(e) => setVatCodeZero(e.target.value)} onBlur={() => handleSaveExactField("vat_code_zero", vatCodeZero)} className={inputClass} placeholder="VN" />
                </div>
              </div>
            </div>
            <label className="flex items-center justify-between gap-3 pt-2">
              <div>
                <span className="text-[13px] font-medium">Facturen automatisch finaliseren</span>
                <p className="text-[11px] text-muted-foreground">Facturen direct verwerken in Exact (krijgen een factuurnummer)</p>
              </div>
              <button type="button" role="switch" aria-checked={autoFinalize} onClick={() => { const newVal = !autoFinalize; setAutoFinalize(newVal); handleSaveExactField("auto_finalize", newVal); }}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${autoFinalize ? 'bg-primary' : 'bg-muted'}`}>
                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-lg ring-0 transition-transform ${autoFinalize ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </label>
          </div>
        </div>
      ) : isPending ? (
        <div className="space-y-2">
          <p className="text-[11px] text-warning font-bold flex items-center gap-1">⏳ Wachten op autorisatie...</p>
          <p className="text-[12px] text-muted-foreground">Rond de autorisatie af in Exact Online. Klik daarna op "Status vernieuwen".</p>
          <div className="flex gap-2">
            <button onClick={handleRefreshStatus} className="px-3 py-2 bg-primary text-primary-foreground rounded-sm text-[12px] font-bold hover:bg-primary-hover transition-colors">Status vernieuwen</button>
            <button onClick={handleConnect} disabled={connecting} className="px-3 py-2 bg-secondary text-secondary-foreground rounded-sm text-[12px] font-medium hover:bg-secondary/80 transition-colors">{connecting ? "Bezig..." : "Opnieuw starten"}</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[12px] text-muted-foreground">Koppel Exact Online om facturen, offertes en klanten automatisch te synchroniseren.</p>
          <button onClick={handleConnect} disabled={connecting} className="px-4 py-2 bg-primary text-primary-foreground rounded-sm text-[12px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50">
            {connecting ? <><Loader2 className="h-3 w-3 animate-spin inline mr-1" /> Koppeling starten...</> : "Koppeling starten"}
          </button>
          <div className="bg-muted/50 border border-border rounded-lg p-3 text-[12px] text-muted-foreground space-y-1.5">
            <p className="font-semibold text-secondary-foreground">Zo werkt het:</p>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>Klik op "Koppeling starten"</li>
              <li>Log in bij Exact Online in het nieuwe venster</li>
              <li>Geef toestemming voor de koppeling</li>
              <li>Kom terug en klik op "Status vernieuwen"</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════
   Token Field
   ═══════════════════════════════════════════ */
const TokenField = ({ label, fieldName, hasToken, saving, onSave }: { label: string; fieldName: string; hasToken: boolean; saving: boolean; onSave: (field: string, value: string) => void }) => {
  const [val, setVal] = useState("");
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="flex gap-2">
        <input value={val} onChange={(e) => setVal(e.target.value)} className={inputClass} placeholder={hasToken ? "••••••••" : "Plak hier je token"} />
        <button onClick={() => { onSave(fieldName, val); setVal(""); }} disabled={saving || !val} className="px-3 py-2 bg-primary text-primary-foreground rounded-sm text-[12px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50 whitespace-nowrap">
          Opslaan
        </button>
      </div>
      {hasToken && <p className="text-[11px] text-success mt-1 flex items-center gap-1"><Check className="h-3 w-3" /> Token ingesteld</p>}
    </div>
  );
};

/* ═══════════════════════════════════════════
   Provider Definitions
   ═══════════════════════════════════════════ */
interface ProviderDef {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
}

const PROVIDERS: ProviderDef[] = [
  { key: "exact", label: "Exact Online", description: "Volledige boekhouding met OAuth-koppeling", enabled: true },
  { key: "wefact", label: "WeFact", description: "Factuur- en debiteurenbeheer via API", enabled: true },
  { key: "eboekhouden", label: "e-Boekhouden", description: "Online boekhoudpakket", enabled: false },
  { key: "moneybird", label: "Moneybird", description: "Boekhouden voor ondernemers", enabled: false },
  { key: "rompslomp", label: "Rompslomp", description: "Eenvoudige boekhouding", enabled: false },
  { key: "snelstart", label: "SnelStart", description: "Boekhoudpakket voor het MKB", enabled: false },
];

/* ═══════════════════════════════════════════
   Main Settings Tab
   ═══════════════════════════════════════════ */
const SettingsAccountingTab = () => {
  const { companyId } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeProvider, setActiveProvider] = useState<string>("");
  const [configProvider, setConfigProvider] = useState<string | null>(null); // provider being configured
  const [form, setForm] = useState<Record<string, string | number>>({});
  const [hasTokens, setHasTokens] = useState<Record<string, boolean>>({});
  const [syncInvoices, setSyncInvoices] = useState(true);
  const [syncQuotes, setSyncQuotes] = useState(false);
  const [switchConfirm, setSwitchConfirm] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Snelstart hooks
  const { data: snelstartConn, isLoading: snelLoading } = useSnelstartConnection();
  const saveSnelstart = useSaveSnelstartConnection();
  const deleteSnelstart = useDeleteSnelstartConnection();
  const testSnelstart = useTestSnelstartConnection();
  const [snelstartKey, setSnelstartKey] = useState("");

  // Exact connected status
  const [exactConnected, setExactConnected] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const { data } = await supabase.from("companies_safe" as any).select(
        "accounting_provider, has_eboekhouden_token, has_wefact_key, eboekhouden_ledger_id, eboekhouden_template_id, eboekhouden_debtor_ledger_id, moneybird_administration_id, rompslomp_company_name, rompslomp_company_id, rompslomp_tenant_id, sync_invoices_to_accounting, sync_quotes_to_accounting"
      ).eq("id", companyId).single() as { data: any };
      if (data) {
        setActiveProvider(data.accounting_provider ?? "");
        setHasTokens({ eboekhouden: !!data.has_eboekhouden_token, wefact: !!data.has_wefact_key });
        setSyncInvoices(data.sync_invoices_to_accounting ?? true);
        setSyncQuotes(data.sync_quotes_to_accounting ?? false);
        setForm({
          eboekhouden_ledger_id: data.eboekhouden_ledger_id ?? "",
          eboekhouden_template_id: data.eboekhouden_template_id ?? "",
          eboekhouden_debtor_ledger_id: data.eboekhouden_debtor_ledger_id ?? "",
          moneybird_administration_id: data.moneybird_administration_id ?? "",
          rompslomp_company_name: data.rompslomp_company_name ?? "",
          rompslomp_company_id: data.rompslomp_company_id ?? "",
          rompslomp_tenant_id: data.rompslomp_tenant_id ?? "",
        });
      }

      // Check exact connection status
      const { data: exactData } = await supabase.from("exact_config").select("status").eq("company_id", companyId!).maybeSingle();
      setExactConnected(exactData?.status === "connected");

      setLoading(false);
    })();
  }, [companyId]);

  const getProviderStatus = (key: string): "connected" | "not_connected" | "coming_soon" => {
    const def = PROVIDERS.find(p => p.key === key);
    if (!def?.enabled) return "coming_soon";
    if (key === "exact") return exactConnected ? "connected" : "not_connected";
    if (key === "wefact") return hasTokens.wefact ? "connected" : "not_connected";
    return "not_connected";
  };

  const handleSelectProvider = (key: string) => {
    const def = PROVIDERS.find(p => p.key === key);
    if (!def?.enabled) {
      toast({ title: `${def?.label} wordt binnenkort ondersteund`, description: "We werken aan deze integratie. Houd de updates in de gaten!" });
      return;
    }
    // If switching from an active provider, confirm first
    if (activeProvider && activeProvider !== key) {
      setSwitchConfirm(key);
      return;
    }
    setConfigProvider(key);
  };

  const handleConfirmSwitch = async () => {
    if (!switchConfirm || !companyId) return;
    setSaving(true);
    await supabase.from("companies").update({ accounting_provider: switchConfirm }).eq("id", companyId);
    setActiveProvider(switchConfirm);
    setConfigProvider(switchConfirm);
    setSwitchConfirm(null);
    setSaving(false);
    toast({ title: `Gewisseld naar ${PROVIDERS.find(p => p.key === switchConfirm)?.label}` });
  };

  const handleSaveProvider = async (providerKey: string) => {
    if (!companyId) return;
    setSaving(true);
    const { error } = await supabase.from("companies").update({ accounting_provider: providerKey || null }).eq("id", companyId);
    setSaving(false);
    if (!error) {
      setActiveProvider(providerKey);
      toast({ title: "Boekhoudprovider opgeslagen" });
    } else {
      toast({ title: "Fout", description: error.message, variant: "destructive" });
    }
  };

  const handleSaveCredentials = async () => {
    if (!companyId) return;
    setSaving(true);
    const updates: Record<string, any> = {};
    if (configProvider === "eboekhouden") {
      updates.eboekhouden_ledger_id = form.eboekhouden_ledger_id || null;
      updates.eboekhouden_template_id = form.eboekhouden_template_id || null;
      updates.eboekhouden_debtor_ledger_id = form.eboekhouden_debtor_ledger_id || null;
    } else if (configProvider === "moneybird") {
      updates.moneybird_administration_id = form.moneybird_administration_id || null;
    } else if (configProvider === "rompslomp") {
      updates.rompslomp_company_name = form.rompslomp_company_name || null;
      updates.rompslomp_company_id = form.rompslomp_company_id || null;
      updates.rompslomp_tenant_id = form.rompslomp_tenant_id || null;
    }
    const { error } = await supabase.from("companies").update(updates).eq("id", companyId);
    setSaving(false);
    toast(error ? { title: "Fout", description: error.message, variant: "destructive" } : { title: "Instellingen opgeslagen" });
  };

  const handleSaveToken = async (tokenField: string, tokenValue: string) => {
    if (!companyId || !tokenValue) return;
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("save-smtp-credentials", {
      body: { company_id: companyId, field: tokenField, value: tokenValue },
    });
    setSaving(false);
    if (error || data?.error) {
      toast({ title: "Fout", description: (data?.error || error?.message), variant: "destructive" });
    } else {
      setHasTokens((prev) => ({ ...prev, [configProvider ?? ""]: true }));
      toast({ title: "Token opgeslagen" });
    }
  };

  const handleSync = async (action: string) => {
    if (!activeProvider) return;
    setSyncing(true);
    const funcMap: Record<string, string> = {
      exact: "sync-exact",
      wefact: "sync-wefact",
    };
    const funcName = funcMap[activeProvider];
    if (!funcName) { setSyncing(false); return; }
    try {
      const { data, error } = await supabase.functions.invoke(funcName, { body: { action } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const synced = data?.synced ?? data?.created ?? 0;
      toast({ title: "✓ Synchronisatie voltooid", description: `${synced} verwerkt` });
    } catch (err: any) {
      toast({ title: "Sync mislukt", description: err.message, variant: "destructive" });
    }
    setSyncing(false);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const field = (label: string, key: string, placeholder = "") => (
    <div>
      <label className={labelClass}>{label}</label>
      <input value={form[key] ?? ""} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} className={inputClass} placeholder={placeholder} />
    </div>
  );

  const statusBadge = (status: "connected" | "not_connected" | "coming_soon") => {
    if (status === "connected") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-success-muted text-success"><CheckCircle className="h-3 w-3" />Gekoppeld</span>;
    if (status === "coming_soon") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary"><Clock className="h-3 w-3" />Binnenkort</span>;
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground">Niet gekoppeld</span>;
  };

  return (
    <div className="bg-card border border-border rounded-lg shadow-card p-5 md:p-6 space-y-6">
      <div>
        <h2 className="text-[15px] font-bold mb-1">Boekhoudkoppeling</h2>
        <p className="text-[12px] text-muted-foreground">Koppel je boekhoudpakket om facturen en klanten automatisch te synchroniseren.</p>
      </div>

      {/* Provider Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {PROVIDERS.map((p) => {
          const status = getProviderStatus(p.key);
          const isActive = activeProvider === p.key;
          const isDisabled = !p.enabled;

          return (
            <div
              key={p.key}
              onClick={() => handleSelectProvider(p.key)}
              className={`relative border rounded-lg p-4 transition-all cursor-pointer ${
                isDisabled
                  ? "opacity-50 cursor-not-allowed border-border bg-muted/30"
                  : isActive
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                    : "border-border hover:border-primary/40 hover:bg-muted/30"
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-md flex items-center justify-center ${isActive ? "bg-primary/10" : "bg-muted"}`}>
                    <Link2 className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div>
                    <h3 className="text-[13px] font-bold">{p.label}</h3>
                  </div>
                </div>
                {statusBadge(status)}
              </div>
              <p className="text-[11px] text-muted-foreground">{p.description}</p>
              {isActive && <div className="absolute top-2 right-2"><Check className="h-3.5 w-3.5 text-primary" /></div>}
              {!isDisabled && status !== "connected" && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleSelectProvider(p.key); }}
                  className="mt-3 w-full px-3 py-1.5 bg-primary text-primary-foreground rounded-sm text-[11px] font-bold hover:bg-primary-hover transition-colors"
                >
                  Configureren
                </button>
              )}
              {!isDisabled && status === "connected" && (
                <button
                  onClick={(e) => { e.stopPropagation(); setConfigProvider(p.key); }}
                  className="mt-3 w-full px-3 py-1.5 bg-secondary text-secondary-foreground rounded-sm text-[11px] font-bold hover:bg-secondary/80 transition-colors"
                >
                  Instellingen
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Sync toggles — only when a provider is active */}
      {activeProvider && PROVIDERS.find(p => p.key === activeProvider)?.enabled && (
        <div className="border-t border-border pt-5 space-y-3">
          <h3 className="text-[14px] font-bold">Automatische synchronisatie</h3>
          <div className="space-y-3">
            <label className="flex items-center justify-between gap-3">
              <div>
                <span className="text-[13px] font-medium">Facturen automatisch syncen</span>
                <p className="text-[11px] text-muted-foreground">Nieuwe facturen worden direct naar {PROVIDERS.find(p => p.key === activeProvider)?.label} gestuurd</p>
              </div>
              <button type="button" role="switch" aria-checked={syncInvoices} onClick={async () => {
                const newVal = !syncInvoices;
                setSyncInvoices(newVal);
                if (companyId) {
                  await supabase.from("companies").update({ sync_invoices_to_accounting: newVal }).eq("id", companyId);
                  toast({ title: newVal ? "Factuur-sync ingeschakeld" : "Factuur-sync uitgeschakeld" });
                }
              }} className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${syncInvoices ? 'bg-primary' : 'bg-muted'}`}>
                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-lg ring-0 transition-transform ${syncInvoices ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </label>
            <label className="flex items-center justify-between gap-3">
              <div>
                <span className="text-[13px] font-medium">Offertes automatisch syncen</span>
                <p className="text-[11px] text-muted-foreground">Nieuwe offertes worden direct naar {PROVIDERS.find(p => p.key === activeProvider)?.label} gestuurd</p>
              </div>
              <button type="button" role="switch" aria-checked={syncQuotes} onClick={async () => {
                const newVal = !syncQuotes;
                setSyncQuotes(newVal);
                if (companyId) {
                  await supabase.from("companies").update({ sync_quotes_to_accounting: newVal }).eq("id", companyId);
                  toast({ title: newVal ? "Offerte-sync ingeschakeld" : "Offerte-sync uitgeschakeld" });
                }
              }} className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${syncQuotes ? 'bg-primary' : 'bg-muted'}`}>
                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-lg ring-0 transition-transform ${syncQuotes ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </label>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => handleSync("sync-invoices")} disabled={syncing} className="px-3 py-2 bg-primary text-primary-foreground rounded-sm text-[12px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center gap-1">
              {syncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
              Nu synchroniseren
            </button>
          </div>
        </div>
      )}

      {/* Provider Configuration Panels */}
      {configProvider === "exact" && (
        <div className="border-t border-border pt-5">
          <h3 className="text-[14px] font-bold mb-3">Exact Online configuratie</h3>
          <ExactOnlineSection companyId={companyId} saving={saving} />
          {activeProvider !== "exact" && (
            <button onClick={() => handleSaveProvider("exact")} disabled={saving} className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-sm text-[12px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50">
              Exact Online als actieve provider instellen
            </button>
          )}
        </div>
      )}

      {configProvider === "wefact" && (
        <div className="border-t border-border pt-5 space-y-3">
          <h3 className="text-[14px] font-bold">WeFact configuratie</h3>
          <TokenField label="API Key" fieldName="wefact_api_key" hasToken={hasTokens.wefact} saving={saving} onSave={handleSaveToken} />
          <div className="bg-muted/50 border border-border rounded-lg p-3 text-[12px] text-muted-foreground space-y-1.5">
            <p className="font-semibold text-secondary-foreground">Zo koppel je WeFact:</p>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>Ga in WeFact naar <span className="font-medium">Instellingen → API</span></li>
              <li>Schakel de API in</li>
              <li>Voeg bij IP-whitelist toe: <code className="bg-muted px-1 rounded font-mono">0.0.0.0/0</code></li>
              <li>Kopieer de beveiligingscode en plak deze hierboven</li>
            </ol>
          </div>
          {activeProvider !== "wefact" && (
            <button onClick={() => handleSaveProvider("wefact")} disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded-sm text-[12px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50">
              WeFact als actieve provider instellen
            </button>
          )}
        </div>
      )}

      {/* Switch Confirmation Dialog */}
      <AlertDialog open={!!switchConfirm} onOpenChange={() => setSwitchConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Provider wisselen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je wilt wisselen naar {PROVIDERS.find(p => p.key === switchConfirm)?.label}? De vorige koppeling ({PROVIDERS.find(p => p.key === activeProvider)?.label}) blijft bewaard maar wordt niet meer gebruikt voor synchronisatie.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSwitch}>Wisselen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SettingsAccountingTab;