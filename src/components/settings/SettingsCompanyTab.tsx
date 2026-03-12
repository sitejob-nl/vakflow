import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload } from "lucide-react";
import KvkSearchInput from "@/components/KvkSearchInput";
import { SETTINGS_INPUT_CLASS as inputClass, SETTINGS_LABEL_CLASS as labelClass } from "./shared";

const SettingsCompanyTab = () => {
  const { companyId } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    name: "", address: "", postal_code: "", city: "", phone: "",
    kvk_number: "", btw_number: "", iban: "", logo_url: "",
  });

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const { data } = await supabase.from("companies_safe" as any).select("name, address, postal_code, city, phone, kvk_number, btw_number, iban, logo_url").eq("id", companyId).single() as { data: any };
      if (data) setForm({
        name: data.name ?? "", address: data.address ?? "", postal_code: data.postal_code ?? "",
        city: data.city ?? "", phone: data.phone ?? "", kvk_number: data.kvk_number ?? "",
        btw_number: data.btw_number ?? "", iban: data.iban ?? "", logo_url: data.logo_url ?? "",
      });
      setLoading(false);
    })();
  }, [companyId]);

  const handleSave = async () => {
    if (!companyId) return;
    setSaving(true);
    const { error } = await supabase.from("companies").update(form).eq("id", companyId);
    setSaving(false);
    toast(error ? { title: "Fout", description: error.message, variant: "destructive" } : { title: "Bedrijfsgegevens opgeslagen" });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !companyId) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${companyId}/logo.${ext}`;
    const { error: uploadError } = await supabase.storage.from("company-assets").upload(path, file, { upsert: true });
    if (uploadError) { toast({ title: "Upload mislukt", description: uploadError.message, variant: "destructive" }); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("company-assets").getPublicUrl(path);
    const logo_url = urlData.publicUrl;
    await supabase.from("companies").update({ logo_url }).eq("id", companyId);
    setForm((f) => ({ ...f, logo_url }));
    setUploading(false);
    toast({ title: "Logo geüpload" });
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const field = (label: string, key: keyof typeof form, placeholder = "") => (
    <div>
      <label className={labelClass}>{label}</label>
      <input value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} className={inputClass} placeholder={placeholder} />
    </div>
  );

  return (
    <div className="bg-card border border-border rounded-lg shadow-card p-5 md:p-6 space-y-4">
      {/* Logo */}
      <div>
        <label className={labelClass}>Logo</label>
        <div className="flex items-center gap-4">
          {form.logo_url && <img src={form.logo_url} alt="Logo" className="h-12 w-12 object-contain rounded border border-border" />}
          <label className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-sm text-[12px] font-medium hover:bg-secondary/80 transition-colors cursor-pointer">
            <Upload className="h-3.5 w-3.5" />
            {uploading ? "Uploaden..." : "Logo uploaden"}
            <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" disabled={uploading} />
          </label>
        </div>
      </div>

      {/* KVK zoeken */}
      <div>
        <label className={labelClass}>KvK-nummer / Bedrijfsnaam zoeken</label>
        <KvkSearchInput
          initialValue={form.kvk_number}
          onCompanySelected={(data) => {
            const addr = data.visit_address;
            setForm((f) => ({
              ...f,
              kvk_number: data.kvk_number,
              name: data.company_name || f.name,
              address: addr ? `${addr.street} ${addr.house_number}`.trim() : f.address,
              postal_code: addr?.postal_code || f.postal_code,
              city: addr?.city || f.city,
            }));
          }}
        />
      </div>

      {field("Bedrijfsnaam", "name", "Uw bedrijfsnaam")}
      {field("Adres", "address", "Straat + huisnummer")}
      <div className="grid grid-cols-2 gap-3">
        {field("Postcode", "postal_code", "1234 AB")}
        {field("Plaats", "city", "Amsterdam")}
      </div>
      {field("Telefoon", "phone", "06-12345678")}
      <div className="grid grid-cols-2 gap-3">
        {field("BTW-nummer", "btw_number", "NL123456789B01")}
        {field("IBAN", "iban", "NL00BANK0123456789")}
      </div>

      <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 bg-primary text-primary-foreground rounded-sm text-[13px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50">
        {saving ? "Opslaan..." : "Opslaan"}
      </button>
    </div>
  );
};

export default SettingsCompanyTab;
