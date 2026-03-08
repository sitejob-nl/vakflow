import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { usePersonalOutlookToken, useDeletePersonalOutlookToken } from "@/hooks/useOutlookOverrides";
import { SETTINGS_INPUT_CLASS as inputClass, SETTINGS_LABEL_CLASS as labelClass } from "./shared";

const PersonalOutlookSection = () => {
  const { toast } = useToast();
  const { data: personalToken, isLoading: tokenLoading } = usePersonalOutlookToken();
  const deleteToken = useDeletePersonalOutlookToken();
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data === "outlook-personal-connected") {
        toast({ title: "Persoonlijke Outlook gekoppeld!" });
        window.location.reload();
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("outlook-auth-url", { body: { scope: "personal" } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      window.open(data.url, "outlook-personal-auth", "width=600,height=700");
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
    setConnecting(false);
  };

  return (
    <div className="border-t border-border pt-5 mt-5">
      <h3 className="text-[14px] font-bold mb-1">Jouw Outlook Agenda</h3>
      <p className="text-[12px] text-secondary-foreground mb-3">
        Koppel je persoonlijke Outlook-agenda zodat je eigen afspraken zichtbaar zijn in de planning.
      </p>
      {tokenLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : personalToken ? (
        <div className="space-y-2">
          <p className="text-[11px] text-success font-bold">✓ Outlook gekoppeld{personalToken.outlook_email ? ` — ${personalToken.outlook_email}` : ""}</p>
          <div className="flex gap-2">
            <button onClick={handleConnect} disabled={connecting} className="px-4 py-2 bg-secondary text-secondary-foreground rounded-sm text-[12px] font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50">
              {connecting ? "Bezig..." : "Opnieuw koppelen"}
            </button>
            <button onClick={() => deleteToken.mutateAsync().then(() => toast({ title: "Persoonlijke Outlook ontkoppeld" }))} disabled={deleteToken.isPending} className="px-4 py-2 bg-destructive/10 text-destructive rounded-sm text-[12px] font-medium hover:bg-destructive/20 transition-colors">
              Ontkoppelen
            </button>
          </div>
        </div>
      ) : (
        <button onClick={handleConnect} disabled={connecting} className="px-5 py-2.5 bg-primary text-primary-foreground rounded-sm text-[13px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50">
          {connecting ? "Bezig..." : "Koppel je Outlook"}
        </button>
      )}
    </div>
  );
};

const SettingsProfileTab = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) {
        setFullName(data.full_name ?? "");
        setPhone(data.phone ?? "");
      }
      setLoading(false);
    })();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: fullName, phone }).eq("id", user.id);
    setSaving(false);
    toast(error ? { title: "Fout", description: error.message, variant: "destructive" } : { title: "Profiel opgeslagen" });
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { toast({ title: "Fout", description: "Wachtwoord moet minimaal 6 tekens bevatten", variant: "destructive" }); return; }
    if (newPassword !== confirmPassword) { toast({ title: "Fout", description: "Wachtwoorden komen niet overeen", variant: "destructive" }); return; }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) { toast({ title: "Fout", description: error.message, variant: "destructive" }); } else { setNewPassword(""); setConfirmPassword(""); toast({ title: "Wachtwoord gewijzigd" }); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="bg-card border border-border rounded-lg shadow-card p-5 md:p-6 space-y-4">
      <div>
        <label className={labelClass}>Naam</label>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} placeholder="Volledige naam" />
      </div>
      <div>
        <label className={labelClass}>Telefoon</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} placeholder="06-12345678" />
      </div>
      <div>
        <label className={labelClass}>E-mail</label>
        <input value={user?.email ?? ""} disabled className={`${inputClass} opacity-60 cursor-not-allowed`} />
        <p className="text-[11px] text-t3 mt-1">E-mailadres kan niet gewijzigd worden</p>
      </div>
      <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 bg-primary text-primary-foreground rounded-sm text-[13px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50">
        {saving ? "Opslaan..." : "Opslaan"}
      </button>

      <div className="border-t border-border pt-5 mt-5">
        <h3 className="text-[14px] font-bold mb-1">Wachtwoord wijzigen</h3>
        <p className="text-[12px] text-secondary-foreground mb-3">Voer je nieuwe wachtwoord in om het te wijzigen.</p>
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Nieuw wachtwoord</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} placeholder="Minimaal 6 tekens" />
          </div>
          <div>
            <label className={labelClass}>Bevestig wachtwoord</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} placeholder="Herhaal nieuw wachtwoord" />
          </div>
          <button onClick={handleChangePassword} disabled={changingPassword || !newPassword || !confirmPassword} className="px-5 py-2.5 bg-primary text-primary-foreground rounded-sm text-[13px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50">
            {changingPassword ? "Wijzigen..." : "Wachtwoord wijzigen"}
          </button>
        </div>
        <PersonalOutlookSection />
      </div>
    </div>
  );
};

export default SettingsProfileTab;
