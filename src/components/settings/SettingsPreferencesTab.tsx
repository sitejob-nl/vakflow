import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload } from "lucide-react";
import { SETTINGS_INPUT_CLASS as inputClass, SETTINGS_LABEL_CLASS as labelClass } from "./shared";

const ALL_FEATURES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "planning", label: "Planning" },
  { key: "customers", label: "Klanten" },
  { key: "workorders", label: "Werkbonnen" },
  { key: "invoices", label: "Facturen" },
  { key: "quotes", label: "Offertes" },
  { key: "reports", label: "Rapportages" },
  { key: "email", label: "E-mail" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "communication", label: "Communicatie" },
  { key: "reminders", label: "Herinneringen" },
  { key: "assets", label: "Assets / Objecten" },
  { key: "marketing", label: "Marketing (Meta)" },
  { key: "contracts", label: "Contracten" },
  { key: "vehicles", label: "Voertuigen" },
  { key: "leads", label: "Leads" },
  { key: "api", label: "API" },
];

const SettingsPreferencesTab = () => {
  const { companyId, refreshCompanyData } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pwaName, setPwaName] = useState("");
  const [pwaIconUrl, setPwaIconUrl] = useState("");
  const [brandColor, setBrandColor] = useState("");
  const [enabledFeatures, setEnabledFeatures] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const { data } = await supabase.from("companies_safe" as any).select("pwa_name, pwa_icon_url, brand_color, enabled_features").eq("id", companyId).single() as { data: any };
      if (data) {
        setPwaName(data.pwa_name ?? "");
        setPwaIconUrl(data.pwa_icon_url ?? "");
        setBrandColor(data.brand_color ?? "");
        setEnabledFeatures(data.enabled_features ?? []);
      }
      setLoading(false);
    })();
  }, [companyId]);

  const handleSave = async () => {
    if (!companyId) return;
    setSaving(true);
    const { error } = await supabase.from("companies").update({
      pwa_name: pwaName || null,
      pwa_icon_url: pwaIconUrl || null,
      brand_color: brandColor || null,
      enabled_features: enabledFeatures,
    }).eq("id", companyId);
    setSaving(false);
    toast(error ? { title: "Fout", description: error.message, variant: "destructive" } : { title: "Voorkeuren opgeslagen" });
    if (!error) await refreshCompanyData();
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !companyId) return;
    setUploading(true);
    const path = `${companyId}/pwa-icon.png`;
    const { error } = await supabase.storage.from("company-assets").upload(path, file, { upsert: true });
    if (error) { toast({ title: "Upload mislukt", variant: "destructive" }); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("company-assets").getPublicUrl(path);
    setPwaIconUrl(urlData.publicUrl);
    setUploading(false);
  };

  const toggleFeature = (key: string) => {
    setEnabledFeatures((prev) => prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="bg-card border border-border rounded-lg shadow-card p-5 md:p-6 space-y-5">
      {/* PWA */}
      <div>
        <h3 className="text-[14px] font-bold mb-3">PWA-instellingen</h3>
        <div className="space-y-3">
          <div>
            <label className={labelClass}>App-naam</label>
            <input value={pwaName} onChange={(e) => setPwaName(e.target.value)} className={inputClass} placeholder="Bijv. MijnBedrijf" />
            <p className="text-[11px] text-muted-foreground mt-1">Wordt getoond op het startscherm van de telefoon</p>
          </div>
          <div>
            <label className={labelClass}>App-icoon</label>
            <div className="flex items-center gap-3">
              {pwaIconUrl && <img src={pwaIconUrl} alt="PWA icoon" className="h-10 w-10 rounded border border-border" />}
              <label className="flex items-center gap-2 px-3 py-2 bg-secondary text-secondary-foreground rounded-sm text-[12px] font-medium hover:bg-secondary/80 transition-colors cursor-pointer">
                <Upload className="h-3.5 w-3.5" />
                {uploading ? "Uploaden..." : "Icoon uploaden"}
                <input type="file" accept="image/png" onChange={handleIconUpload} className="hidden" disabled={uploading} />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Brand color */}
      <div className="border-t border-border pt-5">
        <h3 className="text-[14px] font-bold mb-3">Huisstijlkleur</h3>
        <div className="flex items-center gap-3">
          <input type="color" value={brandColor || "#3b82f6"} onChange={(e) => setBrandColor(e.target.value)} className="h-10 w-10 rounded border border-border cursor-pointer p-0.5" />
          <input value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className={`${inputClass} max-w-[160px]`} placeholder="#3b82f6" />
        </div>
      </div>

      {/* Features */}
      <div className="border-t border-border pt-5">
        <h3 className="text-[14px] font-bold mb-3">Actieve modules</h3>
        <div className="grid grid-cols-2 gap-2">
          {ALL_FEATURES.map((f) => (
            <label key={f.key} className="flex items-center gap-2 text-[13px] cursor-pointer">
              <input type="checkbox" checked={enabledFeatures.includes(f.key)} onChange={() => toggleFeature(f.key)} className="rounded border-border" />
              {f.label}
            </label>
          ))}
        </div>
      </div>

      <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 bg-primary text-primary-foreground rounded-sm text-[13px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50">
        {saving ? "Opslaan..." : "Opslaan"}
      </button>
    </div>
  );
};

export default SettingsPreferencesTab;
