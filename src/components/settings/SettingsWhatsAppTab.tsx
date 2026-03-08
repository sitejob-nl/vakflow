import { useState } from "react";
import { useWhatsAppStatus } from "@/hooks/useWhatsAppStatus";
import { useWhatsAppProfile, useUpdateWhatsAppProfile } from "@/hooks/useWhatsAppProfile";
import { useWhatsAppTemplates } from "@/hooks/useWhatsAppTemplates";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Check, X, MessageSquare } from "lucide-react";
import { SETTINGS_INPUT_CLASS as inputClass, SETTINGS_LABEL_CLASS as labelClass } from "./shared";

const SettingsWhatsAppTab = () => {
  const { companyId } = useAuth();
  const { toast } = useToast();
  const { data: status, isLoading: statusLoading } = useWhatsAppStatus();
  const { data: profile, isLoading: profileLoading } = useWhatsAppProfile(!!status?.connected);
  const { data: templates, isLoading: templatesLoading } = useWhatsAppTemplates(!!status?.connected);
  const updateProfile = useUpdateWhatsAppProfile();

  const [registering, setRegistering] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");

  // Profile edit
  const [editProfile, setEditProfile] = useState(false);
  const [about, setAbout] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");

  const startEditProfile = () => {
    setAbout(profile?.about ?? "");
    setDescription(profile?.description ?? "");
    setAddress(profile?.address ?? "");
    setEmail(profile?.email ?? "");
    setEditProfile(true);
  };

  const handleSaveProfile = async () => {
    try {
      await updateProfile.mutateAsync({ about, description, address, email });
      toast({ title: "Profiel bijgewerkt" });
      setEditProfile(false);
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  const handleRegister = async () => {
    if (!companyId || !apiKey || !phoneNumberId) return;
    setRegistering(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-register", {
        body: { company_id: companyId, api_key: apiKey, phone_number_id: phoneNumberId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "WhatsApp gekoppeld!" });
      window.location.reload();
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
    setRegistering(false);
  };

  if (statusLoading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="bg-card border border-border rounded-lg shadow-card p-5 md:p-6 space-y-5">
      {/* Connection status */}
      <div>
        <h3 className="text-[14px] font-bold mb-2">Verbindingsstatus</h3>
        {status?.connected ? (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-[12px] text-success font-bold"><Check className="h-3.5 w-3.5" /> Verbonden</span>
            {status.phone && <span className="text-[12px] text-muted-foreground">— {status.phone}</span>}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[12px] text-destructive font-bold flex items-center gap-1"><X className="h-3.5 w-3.5" /> Niet verbonden</p>
            <div className="space-y-2">
              <div>
                <label className={labelClass}>WhatsApp API Key</label>
                <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} className={inputClass} placeholder="Permanent access token" />
              </div>
              <div>
                <label className={labelClass}>Phone Number ID</label>
                <input value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} className={inputClass} placeholder="Bijv. 123456789012345" />
              </div>
              <button onClick={handleRegister} disabled={registering || !apiKey || !phoneNumberId} className="px-5 py-2.5 bg-primary text-primary-foreground rounded-sm text-[13px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50">
                {registering ? "Koppelen..." : "WhatsApp koppelen"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Business profile */}
      {status?.connected && (
        <div className="border-t border-border pt-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[14px] font-bold">Business Profiel</h3>
            {!editProfile && (
              <button onClick={startEditProfile} className="px-3 py-1.5 bg-secondary text-secondary-foreground rounded-sm text-[12px] font-medium hover:bg-secondary/80 transition-colors">
                Bewerken
              </button>
            )}
          </div>
          {profileLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : editProfile ? (
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Over</label>
                <input value={about} onChange={(e) => setAbout(e.target.value)} className={inputClass} placeholder="Korte beschrijving" />
              </div>
              <div>
                <label className={labelClass}>Beschrijving</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputClass} min-h-[60px]`} placeholder="Uitgebreide beschrijving" />
              </div>
              <div>
                <label className={labelClass}>Adres</label>
                <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>E-mail</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveProfile} disabled={updateProfile.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-sm text-[12px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50">
                  {updateProfile.isPending ? "Opslaan..." : "Opslaan"}
                </button>
                <button onClick={() => setEditProfile(false)} className="px-4 py-2 bg-secondary text-secondary-foreground rounded-sm text-[12px] font-medium hover:bg-secondary/80 transition-colors">
                  Annuleren
                </button>
              </div>
            </div>
          ) : (
            <div className="text-[13px] space-y-1">
              {profile?.about && <p><span className="text-muted-foreground">Over:</span> {profile.about}</p>}
              {profile?.description && <p><span className="text-muted-foreground">Beschrijving:</span> {profile.description}</p>}
              {profile?.email && <p><span className="text-muted-foreground">E-mail:</span> {profile.email}</p>}
              {!profile?.about && !profile?.description && <p className="text-muted-foreground">Geen profielgegevens ingesteld.</p>}
            </div>
          )}
        </div>
      )}

      {/* Templates */}
      {status?.connected && (
        <div className="border-t border-border pt-5">
          <h3 className="text-[14px] font-bold mb-2">Berichttemplates</h3>
          {templatesLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : !templates || templates.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">Geen templates gevonden. Maak templates aan in het Meta Business-dashboard.</p>
          ) : (
            <div className="space-y-1.5">
              {templates.map((t) => (
                <div key={t.name} className="flex items-center justify-between p-2.5 border border-border rounded-sm bg-background">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[13px] font-medium">{t.name}</span>
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${t.status === "APPROVED" ? "bg-success/10 text-success" : t.status === "REJECTED" ? "bg-destructive/10 text-destructive" : "bg-secondary text-secondary-foreground"}`}>
                    {t.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SettingsWhatsAppTab;
