import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check } from "lucide-react";
import { useSnelstartConnection, useSaveSnelstartConnection, useDeleteSnelstartConnection, useTestSnelstartConnection } from "@/hooks/useSnelstart";
import { SETTINGS_INPUT_CLASS as inputClass, SETTINGS_LABEL_CLASS as labelClass } from "./shared";
interface GlAccount {
  id: string;
  code: string;
  description: string;
}

const ExactOnlineSection = ({ companyId, saving: parentSaving }: { companyId: string | null; saving: boolean }) => {
  const { toast } = useToast();
  const [loadingExact, setLoadingExact] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [connection, setConnection] = useState<any>(null);

  // GL / Journal / Item config state
  const [glAccounts, setGlAccounts] = useState<GlAccount[]>([]);
  const [journals, setJournals] = useState<GlAccount[]>([]);
  const [salesItems, setSalesItems] = useState<GlAccount[]>([]);
  const [selectedGl, setSelectedGl] = useState("");
  const [selectedJournal, setSelectedJournal] = useState("");
  const [selectedItem, setSelectedItem] = useState("");
  const [loadingGl, setLoadingGl] = useState(false);
  const [loadingJournals, setLoadingJournals] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [glError, setGlError] = useState("");
  const [journalError, setJournalError] = useState("");
  const [itemError, setItemError] = useState("");

  useEffect(() => {
    if (!companyId) return;
    supabase
      .from("exact_online_connections" as any)
      .select("id, is_active, company_name, tenant_id, exact_division, connected_at, division_id")
      .eq("company_id", companyId)
      .maybeSingle()
      .then(({ data }: { data: any }) => {
        setConnection(data);
        setLoadingExact(false);
      });
  }, [companyId]);

  // Load current exact_config values
  useEffect(() => {
    if (!companyId) return;
    supabase
      .from("exact_config" as any)
      .select("gl_revenue_id, journal_code")
      .eq("company_id", companyId)
      .maybeSingle()
      .then(({ data }: { data: any }) => {
        if (data) {
          setSelectedGl(data.gl_revenue_id ?? "");
          setSelectedJournal(data.journal_code ?? "");
        }
      });
  }, [companyId]);

  // Fetch GL accounts & journals when connected
  const isConnected = connection?.is_active === true;
  const divisionId = connection?.division_id;

  useEffect(() => {
    if (!isConnected || !divisionId) return;

    const fetchExactData = async (endpoint: string, setter: (v: GlAccount[]) => void, setLoading: (v: boolean) => void, setErr: (v: string) => void) => {
      setLoading(true);
      setErr("");
      try {
        const { data, error } = await supabase.functions.invoke("exact-api", {
          body: { divisionId, endpoint, method: "GET" },
        });
        if (error || data?.error) throw new Error(data?.error || error?.message);
        const results = data?.d?.results ?? data?.d ?? [];
        setter(
          results.map((r: any) => ({
            id: r.ID ?? r.Code ?? "",
            code: r.Code?.toString() ?? "",
            description: r.Description ?? "",
          }))
        );
      } catch (err: any) {
        setErr(err.message || "Kon data niet ophalen");
      } finally {
        setLoading(false);
      }
    };

    fetchExactData(
      "financial/GLAccounts?$filter=Type eq 110&$select=ID,Code,Description",
      setGlAccounts, setLoadingGl, setGlError
    );
    fetchExactData(
      "financial/Journals?$filter=Type eq 20&$select=ID,Code,Description",
      setJournals, setLoadingJournals, setJournalError
    );
  }, [isConnected, divisionId]);

  const handleSaveExactConfig = async (field: "gl_revenue_id" | "journal_code", value: string) => {
    if (!companyId) return;
    setSavingConfig(true);
    const updates: Record<string, any> = { company_id: companyId, [field]: value || null };
    const { error } = await supabase.from("exact_config" as any).upsert(updates, { onConflict: "company_id" } as any);
    setSavingConfig(false);
    if (error) {
      toast({ title: "Fout bij opslaan", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Instelling opgeslagen" });
    }
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

      const handleMessage = (e: MessageEvent) => {
        if (e.data?.type === "exact-connected") {
          window.removeEventListener("message", handleMessage);
          handleRefreshStatus();
        }
      };
      window.addEventListener("message", handleMessage);

      toast({ title: "Exact Online koppeling gestart", description: "Rond de autorisatie af in het geopende venster." });
    } catch (err: any) {
      toast({ title: "Fout bij koppelen", description: err.message, variant: "destructive" });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!companyId || !connection) return;
    setDisconnecting(true);
    await supabase.from("exact_online_connections" as any).update({ is_active: false } as any).eq("id", connection.id);
    setConnection(null);
    setDisconnecting(false);
    toast({ title: "Exact Online ontkoppeld" });
  };

  const handleRefreshStatus = async () => {
    if (!companyId) return;
    const { data } = await supabase.from("exact_online_connections" as any).select("id, is_active, company_name, tenant_id, exact_division, connected_at").eq("company_id", companyId).maybeSingle() as { data: any };
    setConnection(data);
    toast({ title: "Status vernieuwd", description: data?.is_active ? "Verbonden" : "Niet verbonden" });
  };

  if (loadingExact) return <div className="border-t border-border pt-5"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;

  const renderDropdown = (
    label: string,
    items: GlAccount[],
    value: string,
    onChange: (v: string) => void,
    field: "gl_revenue_id" | "journal_code",
    loading: boolean,
    error: string
  ) => (
    <div>
      <label className={labelClass}>{label}</label>
      {loading ? (
        <div className="flex items-center gap-2 py-2"><Loader2 className="h-3 w-3 animate-spin text-muted-foreground" /><span className="text-[11px] text-muted-foreground">Laden...</span></div>
      ) : error ? (
        <p className="text-[11px] text-destructive">{error}</p>
      ) : (
        <select
          value={value}
          onChange={(e) => { onChange(e.target.value); handleSaveExactConfig(field, e.target.value); }}
          disabled={savingConfig}
          className={inputClass}
        >
          <option value="">— Selecteer —</option>
          {items.map((item) => (
            <option key={item.id} value={field === "journal_code" ? item.code : item.id}>{item.code} — {item.description}</option>
          ))}
        </select>
      )}
    </div>
  );

  return (
    <div className="border-t border-border pt-5 space-y-3">
      <h3 className="text-[14px] font-bold">Exact Online</h3>

      {isConnected ? (
        <div className="space-y-4">
          <p className="text-[11px] text-success font-bold flex items-center gap-1">
            <Check className="h-3 w-3" /> Exact Online gekoppeld
          </p>
          {connection?.company_name && <p className="text-[12px] text-muted-foreground">Administratie: {connection.company_name}</p>}

          {/* GL & Journal dropdowns */}
          <div className="space-y-3 border-t border-border pt-3">
            <h4 className="text-[13px] font-semibold">Boekhoud-instellingen</h4>
            {renderDropdown("Omzet-grootboekrekening", glAccounts, selectedGl, setSelectedGl, "gl_revenue_id", loadingGl, glError)}
            {renderDropdown("Verkoopjournaal", journals, selectedJournal, setSelectedJournal, "journal_code", loadingJournals, journalError)}
            {!selectedGl && !loadingGl && !glError && (
              <p className="text-[11px] text-amber-600">⚠ Selecteer een grootboekrekening om facturen naar Exact te kunnen syncen.</p>
            )}
          </div>

          <div className="flex gap-2">
            <button onClick={handleRefreshStatus} className="px-3 py-2 bg-secondary text-secondary-foreground rounded-sm text-[12px] font-medium hover:bg-secondary/80 transition-colors">
              Status vernieuwen
            </button>
            <button onClick={handleDisconnect} disabled={disconnecting} className="px-3 py-2 bg-destructive/10 text-destructive rounded-sm text-[12px] font-medium hover:bg-destructive/20 transition-colors">
              {disconnecting ? "Ontkoppelen..." : "Ontkoppelen"}
            </button>
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

const PROVIDERS = [
  { key: "eboekhouden", label: "e-Boekhouden" },
  { key: "moneybird", label: "Moneybird" },
  { key: "rompslomp", label: "Rompslomp" },
  { key: "wefact", label: "WeFact" },
  { key: "exact", label: "Exact Online" },
  { key: "snelstart", label: "SnelStart" },
] as const;


const SettingsAccountingTab = () => {

  const { companyId } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [provider, setProvider] = useState<string>("");
  const [form, setForm] = useState<Record<string, string | number>>({});
  const [hasTokens, setHasTokens] = useState<Record<string, boolean>>({});
  const [syncInvoices, setSyncInvoices] = useState(true);
  const [syncQuotes, setSyncQuotes] = useState(false);

  // Snelstart hooks
  const { data: snelstartConn, isLoading: snelLoading } = useSnelstartConnection();
  const saveSnelstart = useSaveSnelstartConnection();
  const deleteSnelstart = useDeleteSnelstartConnection();
  const testSnelstart = useTestSnelstartConnection();
  const [snelstartKey, setSnelstartKey] = useState("");

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const { data } = await supabase.from("companies_safe" as any).select(
        "accounting_provider, has_eboekhouden_token, has_wefact_key, eboekhouden_ledger_id, eboekhouden_template_id, eboekhouden_debtor_ledger_id, moneybird_administration_id, rompslomp_company_name, rompslomp_company_id, rompslomp_tenant_id, sync_invoices_to_accounting, sync_quotes_to_accounting"
      ).eq("id", companyId).single() as { data: any };
      if (data) {
        setProvider(data.accounting_provider ?? "");
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
      setLoading(false);
    })();
  }, [companyId]);

  const handleSaveProvider = async () => {
    if (!companyId) return;
    setSaving(true);
    const { error } = await supabase.from("companies").update({ accounting_provider: provider || null }).eq("id", companyId);
    setSaving(false);
    toast(error ? { title: "Fout", description: error.message, variant: "destructive" } : { title: "Boekhoudprovider opgeslagen" });
  };

  const handleSaveCredentials = async () => {
    if (!companyId) return;
    setSaving(true);
    const updates: Record<string, any> = {};
    if (provider === "eboekhouden") {
      updates.eboekhouden_ledger_id = form.eboekhouden_ledger_id || null;
      updates.eboekhouden_template_id = form.eboekhouden_template_id || null;
      updates.eboekhouden_debtor_ledger_id = form.eboekhouden_debtor_ledger_id || null;
    } else if (provider === "moneybird") {
      updates.moneybird_administration_id = form.moneybird_administration_id || null;
    } else if (provider === "rompslomp") {
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
      setHasTokens((prev) => ({ ...prev, [provider]: true }));
      toast({ title: "Token opgeslagen" });
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const field = (label: string, key: string, placeholder = "") => (
    <div>
      <label className={labelClass}>{label}</label>
      <input value={form[key] ?? ""} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} className={inputClass} placeholder={placeholder} />
    </div>
  );

  return (
    <div className="bg-card border border-border rounded-lg shadow-card p-5 md:p-6 space-y-5">
      {/* Provider selector */}
      <div>
        <label className={labelClass}>Boekhoudpakket</label>
        <select value={provider} onChange={(e) => setProvider(e.target.value)} className={inputClass}>
          <option value="">— Geen koppeling —</option>
          {PROVIDERS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        <button onClick={handleSaveProvider} disabled={saving} className="mt-2 px-4 py-2 bg-primary text-primary-foreground rounded-sm text-[12px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50">
          Provider opslaan
        </button>
      </div>

      {/* Sync toggles — only when provider is set */}
      {provider && (
        <div className="border-t border-border pt-5 space-y-3">
          <h3 className="text-[14px] font-bold">Automatische synchronisatie</h3>
          <div className="space-y-3">
            <label className="flex items-center justify-between gap-3">
              <div>
                <span className="text-[13px] font-medium">Facturen automatisch syncen</span>
                <p className="text-[11px] text-muted-foreground">Nieuwe facturen worden direct naar {PROVIDERS.find(p => p.key === provider)?.label ?? provider} gestuurd</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={syncInvoices}
                onClick={async () => {
                  const newVal = !syncInvoices;
                  setSyncInvoices(newVal);
                  if (companyId) {
                    await supabase.from("companies").update({ sync_invoices_to_accounting: newVal }).eq("id", companyId);
                    toast({ title: newVal ? "Factuur-sync ingeschakeld" : "Factuur-sync uitgeschakeld" });
                  }
                }}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${syncInvoices ? 'bg-primary' : 'bg-muted'}`}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-lg ring-0 transition-transform ${syncInvoices ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </label>
            <label className="flex items-center justify-between gap-3">
              <div>
                <span className="text-[13px] font-medium">Offertes automatisch syncen</span>
                <p className="text-[11px] text-muted-foreground">Nieuwe offertes worden direct naar {PROVIDERS.find(p => p.key === provider)?.label ?? provider} gestuurd</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={syncQuotes}
                onClick={async () => {
                  const newVal = !syncQuotes;
                  setSyncQuotes(newVal);
                  if (companyId) {
                    await supabase.from("companies").update({ sync_quotes_to_accounting: newVal }).eq("id", companyId);
                    toast({ title: newVal ? "Offerte-sync ingeschakeld" : "Offerte-sync uitgeschakeld" });
                  }
                }}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${syncQuotes ? 'bg-primary' : 'bg-muted'}`}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-lg ring-0 transition-transform ${syncQuotes ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </label>
          </div>
          <p className="text-[11px] text-muted-foreground">Als uitgeschakeld, kun je facturen en offertes handmatig syncen via de sync-knop op de detail-pagina.</p>
        </div>
      )}

      {/* Provider-specific fields */}
      {provider === "eboekhouden" && (
        <div className="border-t border-border pt-5 space-y-3">
          <h3 className="text-[14px] font-bold">e-Boekhouden instellingen</h3>
          <TokenField label="API Token" fieldName="eboekhouden_api_token" hasToken={hasTokens.eboekhouden} saving={saving} onSave={handleSaveToken} />
          {field("Grootboek-ID", "eboekhouden_ledger_id", "Bijv. 8000")}
          {field("Template-ID", "eboekhouden_template_id", "Bijv. 1")}
          {field("Debiteuren Grootboek-ID", "eboekhouden_debtor_ledger_id", "Bijv. 1300")}
          <button onClick={handleSaveCredentials} disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded-sm text-[12px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50">
            Instellingen opslaan
          </button>
        </div>
      )}

    {provider === "moneybird" && (
        <div className="border-t border-border pt-5 space-y-5">
          <div className="space-y-3">
            <h3 className="text-[14px] font-bold">Moneybird instellingen</h3>
            <TokenField label="API Token" fieldName="moneybird_api_token" hasToken={false} saving={saving} onSave={handleSaveToken} />
            {field("Administratie-ID", "moneybird_administration_id", "Bijv. 123456789")}
            <button onClick={handleSaveCredentials} disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded-sm text-[12px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50">
              Instellingen opslaan
            </button>
          </div>
        </div>
      )}

      {provider === "rompslomp" && (
        <div className="border-t border-border pt-5 space-y-5">
          <div className="space-y-3">
            <h3 className="text-[14px] font-bold">Rompslomp instellingen</h3>
            <TokenField label="API Token" fieldName="rompslomp_api_token" hasToken={false} saving={saving} onSave={handleSaveToken} />
            {field("Bedrijfsnaam", "rompslomp_company_name")}
            {field("Bedrijfs-ID", "rompslomp_company_id")}
            {field("Tenant-ID", "rompslomp_tenant_id")}
            <button onClick={handleSaveCredentials} disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded-sm text-[12px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50">
              Instellingen opslaan
            </button>
          </div>
        </div>
      )}

      {provider === "wefact" && (
        <div className="border-t border-border pt-5 space-y-3">
          <h3 className="text-[14px] font-bold">WeFact instellingen</h3>
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
        </div>
      )}

      {provider === "exact" && (
        <ExactOnlineSection companyId={companyId} saving={saving} />
      )}

      {provider === "snelstart" && (
        <div className="border-t border-border pt-5 space-y-3">
          <h3 className="text-[14px] font-bold">SnelStart</h3>
          {snelLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : snelstartConn ? (
            <div className="space-y-2">
              <p className="text-[11px] text-success font-bold flex items-center gap-1"><Check className="h-3 w-3" /> SnelStart gekoppeld</p>
              <div className="flex gap-2">
                <button onClick={() => testSnelstart.mutateAsync().then((r) => toast({ title: `Verbinding OK — ${r.count} relaties gevonden` })).catch((e) => toast({ title: "Test mislukt", description: e.message, variant: "destructive" }))} disabled={testSnelstart.isPending} className="px-3 py-2 bg-secondary text-secondary-foreground rounded-sm text-[12px] font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50">
                  {testSnelstart.isPending ? "Testen..." : "Verbinding testen"}
                </button>
                <button onClick={() => deleteSnelstart.mutateAsync().then(() => toast({ title: "SnelStart ontkoppeld" }))} disabled={deleteSnelstart.isPending} className="px-3 py-2 bg-destructive/10 text-destructive rounded-sm text-[12px] font-medium hover:bg-destructive/20 transition-colors">
                  Ontkoppelen
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className={labelClass}>Client Key</label>
              <div className="flex gap-2">
                <input value={snelstartKey} onChange={(e) => setSnelstartKey(e.target.value)} className={inputClass} placeholder="Plak je SnelStart client key" />
                <button onClick={() => saveSnelstart.mutateAsync({ clientKey: snelstartKey }).then(() => { toast({ title: "SnelStart gekoppeld" }); setSnelstartKey(""); })} disabled={saveSnelstart.isPending || !snelstartKey} className="px-3 py-2 bg-primary text-primary-foreground rounded-sm text-[12px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50 whitespace-nowrap">
                  Koppelen
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SettingsAccountingTab;
