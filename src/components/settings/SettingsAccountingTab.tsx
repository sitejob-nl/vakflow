import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, X } from "lucide-react";
import { useSnelstartConnection, useSaveSnelstartConnection, useDeleteSnelstartConnection, useTestSnelstartConnection } from "@/hooks/useSnelstart";
import { SETTINGS_INPUT_CLASS as inputClass, SETTINGS_LABEL_CLASS as labelClass } from "./shared";

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
        "accounting_provider, has_eboekhouden_token, has_wefact_key, eboekhouden_ledger_id, eboekhouden_template_id, eboekhouden_debtor_ledger_id, moneybird_administration_id, rompslomp_company_name, rompslomp_company_id, rompslomp_tenant_id"
      ).eq("id", companyId).single() as { data: any };
      if (data) {
        setProvider(data.accounting_provider ?? "");
        setHasTokens({ eboekhouden: !!data.has_eboekhouden_token, wefact: !!data.has_wefact_key });
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

  const tokenField = (label: string, fieldName: string, hasToken: boolean) => {
    const [val, setVal] = useState("");
    return (
      <div>
        <label className={labelClass}>{label}</label>
        <div className="flex gap-2">
          <input value={val} onChange={(e) => setVal(e.target.value)} className={inputClass} placeholder={hasToken ? "••••••••" : "Plak hier je token"} />
          <button onClick={() => handleSaveToken(fieldName, val)} disabled={saving || !val} className="px-3 py-2 bg-primary text-primary-foreground rounded-sm text-[12px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50 whitespace-nowrap">
            Opslaan
          </button>
        </div>
        {hasToken && <p className="text-[11px] text-success mt-1 flex items-center gap-1"><Check className="h-3 w-3" /> Token ingesteld</p>}
      </div>
    );
  };

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

      {/* Provider-specific fields */}
      {provider === "eboekhouden" && (
        <div className="border-t border-border pt-5 space-y-3">
          <h3 className="text-[14px] font-bold">e-Boekhouden instellingen</h3>
          {tokenField("API Token", "eboekhouden_api_token", hasTokens.eboekhouden)}
          {field("Grootboek-ID", "eboekhouden_ledger_id", "Bijv. 8000")}
          {field("Template-ID", "eboekhouden_template_id", "Bijv. 1")}
          {field("Debiteuren Grootboek-ID", "eboekhouden_debtor_ledger_id", "Bijv. 1300")}
          <button onClick={handleSaveCredentials} disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded-sm text-[12px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50">
            Instellingen opslaan
          </button>
        </div>
      )}

      {provider === "moneybird" && (
        <div className="border-t border-border pt-5 space-y-3">
          <h3 className="text-[14px] font-bold">Moneybird instellingen</h3>
          {tokenField("API Token", "moneybird_api_token", false)}
          {field("Administratie-ID", "moneybird_administration_id", "Bijv. 123456789")}
          <button onClick={handleSaveCredentials} disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded-sm text-[12px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50">
            Instellingen opslaan
          </button>
        </div>
      )}

      {provider === "rompslomp" && (
        <div className="border-t border-border pt-5 space-y-3">
          <h3 className="text-[14px] font-bold">Rompslomp instellingen</h3>
          {tokenField("API Token", "rompslomp_api_token", false)}
          {field("Bedrijfsnaam", "rompslomp_company_name")}
          {field("Bedrijfs-ID", "rompslomp_company_id")}
          {field("Tenant-ID", "rompslomp_tenant_id")}
          <button onClick={handleSaveCredentials} disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded-sm text-[12px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50">
            Instellingen opslaan
          </button>
        </div>
      )}

      {provider === "wefact" && (
        <div className="border-t border-border pt-5 space-y-3">
          <h3 className="text-[14px] font-bold">WeFact instellingen</h3>
          {tokenField("API Key", "wefact_api_key", hasTokens.wefact)}
          <p className="text-[11px] text-muted-foreground">Let op: WeFact vereist IP-whitelisting van de Supabase Edge Function omgeving.</p>
        </div>
      )}

      {provider === "exact" && (
        <div className="border-t border-border pt-5 space-y-3">
          <h3 className="text-[14px] font-bold">Exact Online</h3>
          <p className="text-[13px] text-muted-foreground">Exact Online wordt gekoppeld via SiteJob Connect. Ga naar Koppelingen voor de status.</p>
        </div>
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
