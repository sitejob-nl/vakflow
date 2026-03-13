import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWhatsAppStatus } from "@/hooks/useWhatsAppStatus";
import { useWhatsAppProfile, useUpdateWhatsAppProfile, useUploadWhatsAppProfilePhoto } from "@/hooks/useWhatsAppProfile";
import { useWhatsAppTemplates, useDeleteWhatsAppTemplate, useCreateWhatsAppTemplate } from "@/hooks/useWhatsAppTemplates";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Loader2, Check, X, MessageSquare, Shield, ShieldCheck, ShieldAlert,
  Trash2, Plus, Upload, Unplug, ChevronDown, ChevronUp, Phone, Globe,
  Image as ImageIcon, AlertCircle
} from "lucide-react";
import { SETTINGS_INPUT_CLASS as inputClass, SETTINGS_LABEL_CLASS as labelClass } from "./shared";

/* ── Phone Quality Hook ── */
function usePhoneQuality(enabled: boolean) {
  return useQuery({
    queryKey: ["whatsapp-phone-quality"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("whatsapp-send", { body: { action: "phone_quality" } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as {
        quality_rating: string | null;
        verified_name: string | null;
        code_verification_status: string | null;
        display_phone_number: string | null;
        name_status: string | null;
        is_official_business_account: boolean;
      };
    },
    enabled,
    staleTime: 60_000,
    retry: false,
  });
}

/* ── Message Stats Hook ── */
function useMessageStats(enabled: boolean, days: number) {
  return useQuery({
    queryKey: ["whatsapp-stats", days],
    queryFn: async () => {
      const since = new Date(Date.now() - days * 86400_000).toISOString();
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("direction, status, created_at")
        .gte("created_at", since);
      if (error) throw error;
      const sent = (data || []).filter((m: any) => m.direction === "outgoing").length;
      const received = (data || []).filter((m: any) => m.direction === "incoming").length;
      const delivered = (data || []).filter((m: any) => m.status === "delivered").length;
      const read = (data || []).filter((m: any) => m.status === "read").length;
      return { sent, received, delivered, read, total: data?.length || 0 };
    },
    enabled,
    staleTime: 30_000,
  });
}

/* ── Quality Badge ── */
function QualityBadge({ rating }: { rating: string | null }) {
  if (!rating) return <span className="text-[11px] text-muted-foreground">Onbekend</span>;
  const colors: Record<string, string> = {
    GREEN: "bg-success/10 text-success",
    YELLOW: "bg-warning/10 text-warning",
    RED: "bg-destructive/10 text-destructive",
  };
  const icons: Record<string, typeof ShieldCheck> = { GREEN: ShieldCheck, YELLOW: Shield, RED: ShieldAlert };
  const Icon = icons[rating] || Shield;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${colors[rating] || "bg-secondary text-secondary-foreground"}`}>
      <Icon className="h-3 w-3" /> {rating}
    </span>
  );
}

/* ── Stat Card ── */
function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="bg-background border border-border rounded-sm p-3 text-center">
      <p className="text-[20px] font-bold text-foreground">{value}</p>
      <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

/* ── Verticals ── */
const VERTICALS = [
  "UNDEFINED", "OTHER", "AUTO", "BEAUTY", "APPAREL", "EDU", "ENTERTAIN",
  "EVENT_PLAN", "FINANCE", "GROCERY", "GOVT", "HOTEL", "HEALTH",
  "NONPROFIT", "PROF_SERVICES", "RETAIL", "TRAVEL", "RESTAURANT",
];

/* ================================================================ */
const SettingsWhatsAppTab = () => {
  const { companyId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: status, isLoading: statusLoading } = useWhatsAppStatus();
  const connected = !!status?.connected;
  const { data: profile, isLoading: profileLoading } = useWhatsAppProfile(connected);
  const { data: templates, isLoading: templatesLoading } = useWhatsAppTemplates(connected);
  const { data: quality, isLoading: qualityLoading } = usePhoneQuality(connected);
  const [statsDays, setStatsDays] = useState(7);
  const { data: stats } = useMessageStats(connected, statsDays);
  const updateProfile = useUpdateWhatsAppProfile();
  const uploadPhoto = useUploadWhatsAppProfilePhoto();
  const deleteTemplate = useDeleteWhatsAppTemplate();
  const createTemplate = useCreateWhatsAppTemplate();
  const fileRef = useRef<HTMLInputElement>(null);

  // Registration state
  const [registering, setRegistering] = useState(false);
  const [registerStep, setRegisterStep] = useState<"idle" | "pending" | "done">("idle");
  const [tenantId, setTenantId] = useState<string | null>(null);

  // Profile edit
  const [editProfile, setEditProfile] = useState(false);
  const [about, setAbout] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [vertical, setVertical] = useState("UNDEFINED");
  const [websites, setWebsites] = useState<string[]>([]);
  const [newWebsite, setNewWebsite] = useState("");

  // Template create
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [tplName, setTplName] = useState("");
  const [tplCategory, setTplCategory] = useState("UTILITY");
  const [tplBody, setTplBody] = useState("");

  // Disconnect
  const [showDisconnect, setShowDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Sections collapsed
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    quality: true, stats: true, profile: false, templates: true,
  });
  const toggleSection = (key: string) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

  const startEditProfile = () => {
    setAbout(profile?.about ?? "");
    setDescription(profile?.description ?? "");
    setAddress(profile?.address ?? "");
    setEmail(profile?.email ?? "");
    setVertical(profile?.vertical ?? "UNDEFINED");
    setWebsites(profile?.websites ?? []);
    setEditProfile(true);
  };

  const handleSaveProfile = async () => {
    try {
      await updateProfile.mutateAsync({ about, description, address, email, vertical, websites });
      toast({ title: "Profiel bijgewerkt" });
      setEditProfile(false);
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadPhoto.mutateAsync(file);
      toast({ title: "Profielfoto bijgewerkt" });
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  const handleRegister = async () => {
    if (!companyId) return;
    setRegistering(true);
    try {
      const webhookUrl = `https://sigzpqwnavfxtvbyqvzj.supabase.co/functions/v1/whatsapp-config`;
      const { data, error } = await supabase.functions.invoke("whatsapp-register", {
        body: { name: `Vakflow-${companyId.substring(0, 8)}`, webhook_url: webhookUrl },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setTenantId(data.tenant_id);
      setRegisterStep("pending");
      toast({ title: data.existing ? "Bestaande koppeling gevonden" : "Tenant geregistreerd", description: "Wacht op configuratie van SiteJob Connect..." });
      // Poll for completion
      pollForConnection();
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
    setRegistering(false);
  };

  const pollForConnection = () => {
    const interval = setInterval(async () => {
      const { data } = await supabase.functions.invoke("whatsapp-send", { body: { action: "status" } });
      if (data?.connected) {
        clearInterval(interval);
        setRegisterStep("done");
        toast({ title: "WhatsApp gekoppeld!" });
        queryClient.invalidateQueries({ queryKey: ["whatsapp-config-status"] });
      }
    }, 5000);
    // Stop polling after 5 minutes
    setTimeout(() => clearInterval(interval), 300_000);
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const { error } = await supabase.functions.invoke("whatsapp-send", { body: { action: "disconnect" } });
      if (error) throw error;
      toast({ title: "WhatsApp ontkoppeld" });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-config-status"] });
      setShowDisconnect(false);
      window.location.reload();
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
    setDisconnecting(false);
  };

  const handleDeleteTemplate = async (name: string) => {
    if (!confirm(`Template "${name}" verwijderen?`)) return;
    try {
      await deleteTemplate.mutateAsync(name);
      toast({ title: "Template verwijderd" });
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  const handleCreateTemplate = async () => {
    if (!tplName || !tplBody) return;
    try {
      await createTemplate.mutateAsync({
        name: tplName.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
        category: tplCategory,
        language: "nl",
        components: [{ type: "BODY", text: tplBody }],
      });
      toast({ title: "Template aangemaakt" });
      setShowCreateTemplate(false);
      setTplName("");
      setTplBody("");
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  if (statusLoading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  /* ── Not connected ── */
  if (!connected) {
    return (
      <div className="bg-card border border-border rounded-lg shadow-card p-5 md:p-6 space-y-5">
        <h3 className="text-[14px] font-bold">WhatsApp koppelen via SiteJob Connect</h3>
        <p className="text-[12px] text-destructive font-bold flex items-center gap-1"><X className="h-3.5 w-3.5" /> Niet verbonden</p>

        {registerStep === "idle" && (
          <div className="space-y-3">
            <p className="text-[12px] text-muted-foreground">
              Klik op de knop hieronder om een WhatsApp Business koppeling aan te maken via SiteJob Connect. Na registratie wordt je WhatsApp-nummer automatisch geconfigureerd.
            </p>
            <button onClick={handleRegister} disabled={registering}
              className="px-5 py-2.5 bg-primary text-primary-foreground rounded-sm text-[13px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center gap-2">
              {registering ? <><Loader2 className="h-4 w-4 animate-spin" /> Registreren...</> : <><MessageSquare className="h-4 w-4" /> WhatsApp koppelen</>}
            </button>
          </div>
        )}

        {registerStep === "pending" && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-4 bg-warning/5 border border-warning/20 rounded-lg">
              <Loader2 className="h-5 w-5 animate-spin text-warning shrink-0" />
              <div>
                <p className="text-[13px] font-bold text-foreground">Wachten op SiteJob Connect configuratie...</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Je tenant is geregistreerd{tenantId ? ` (${tenantId.substring(0, 8)}...)` : ""}. SiteJob Connect zal automatisch je WhatsApp-nummer koppelen. Dit kan een paar minuten duren.
                </p>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              De pagina wordt automatisch bijgewerkt zodra de koppeling compleet is.
            </p>
          </div>
        )}

        {registerStep === "done" && (
          <div className="flex items-center gap-3 p-4 bg-success/5 border border-success/20 rounded-lg">
            <Check className="h-5 w-5 text-success shrink-0" />
            <div>
              <p className="text-[13px] font-bold text-foreground">WhatsApp is gekoppeld!</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Ververs de pagina om het volledige dashboard te zien.</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── Connected ── */
  const SectionHeader = ({ id, title, icon: Icon }: { id: string; title: string; icon: any }) => (
    <button onClick={() => toggleSection(id)} className="flex items-center justify-between w-full py-1 group">
      <h3 className="text-[14px] font-bold flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground" />{title}</h3>
      {expandedSections[id] ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Connection header */}
      <div className="bg-card border border-border rounded-lg shadow-card p-5 md:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
              <Check className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-[13px] font-bold text-foreground">WhatsApp verbonden</p>
              <p className="text-[12px] text-muted-foreground">{quality?.display_phone_number || status?.phone || "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {quality && !qualityLoading && (
              <div className="flex items-center gap-2 mr-2">
                <QualityBadge rating={quality.quality_rating} />
                {quality.verified_name && <span className="text-[11px] text-muted-foreground hidden sm:inline">✓ {quality.verified_name}</span>}
              </div>
            )}
            <button onClick={() => setShowDisconnect(true)}
              className="px-3 py-1.5 bg-destructive/10 text-destructive rounded-sm text-[11px] font-bold hover:bg-destructive/20 transition-colors flex items-center gap-1">
              <Unplug className="h-3 w-3" /> Ontkoppelen
            </button>
          </div>
        </div>

        {/* Quality details */}
        {quality && (
          <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12px]">
            <div><span className="text-muted-foreground">Verificatie:</span> <span className="font-medium">{quality.code_verification_status || "—"}</span></div>
            <div><span className="text-muted-foreground">Naam status:</span> <span className="font-medium">{quality.name_status || "—"}</span></div>
            <div><span className="text-muted-foreground">Officieel:</span> <span className="font-medium">{quality.is_official_business_account ? "Ja" : "Nee"}</span></div>
            <div><span className="text-muted-foreground">Kwaliteit:</span> <QualityBadge rating={quality.quality_rating} /></div>
          </div>
        )}
      </div>

      {/* Disconnect dialog */}
      {showDisconnect && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <p className="text-[13px] font-medium text-foreground">Weet je zeker dat je WhatsApp wilt ontkoppelen? Dit verwijdert de configuratie.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowDisconnect(false)} className="px-3 py-1.5 bg-secondary text-secondary-foreground rounded-sm text-[12px] font-medium">Annuleren</button>
            <button onClick={handleDisconnect} disabled={disconnecting}
              className="px-3 py-1.5 bg-destructive text-destructive-foreground rounded-sm text-[12px] font-bold disabled:opacity-50">
              {disconnecting ? "Ontkoppelen..." : "Bevestigen"}
            </button>
          </div>
        </div>
      )}

      {/* Statistics */}
      <div className="bg-card border border-border rounded-lg shadow-card p-5 md:p-6">
        <div className="flex items-center justify-between mb-3">
          <SectionHeader id="stats" title="Berichtenstatistieken" icon={MessageSquare} />
          <select value={statsDays} onChange={e => setStatsDays(Number(e.target.value))}
            className="text-[11px] bg-background border border-border rounded-sm px-2 py-1 text-foreground">
            <option value={7}>7 dagen</option>
            <option value={14}>14 dagen</option>
            <option value={30}>30 dagen</option>
          </select>
        </div>
        {expandedSections.stats && stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Verstuurd" value={stats.sent} />
            <StatCard label="Ontvangen" value={stats.received} />
            <StatCard label="Afgeleverd" value={stats.delivered} />
            <StatCard label="Gelezen" value={stats.read} />
          </div>
        )}
      </div>

      {/* Business Profile */}
      <div className="bg-card border border-border rounded-lg shadow-card p-5 md:p-6">
        <div className="flex items-center justify-between mb-3">
          <SectionHeader id="profile" title="Business Profiel" icon={Globe} />
          {!editProfile && expandedSections.profile && (
            <button onClick={startEditProfile} className="px-3 py-1.5 bg-secondary text-secondary-foreground rounded-sm text-[12px] font-medium hover:bg-secondary/80 transition-colors">
              Bewerken
            </button>
          )}
        </div>
        {expandedSections.profile && (
          profileLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : editProfile ? (
            <div className="space-y-3">
              {/* Profile photo */}
              <div className="flex items-center gap-3">
                {profile?.profile_picture_url ? (
                  <img src={profile.profile_picture_url} alt="Profiel" className="h-14 w-14 rounded-full object-cover border border-border" />
                ) : (
                  <div className="h-14 w-14 rounded-full bg-secondary flex items-center justify-center"><ImageIcon className="h-6 w-6 text-muted-foreground" /></div>
                )}
                <div>
                  <input type="file" ref={fileRef} accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                  <button onClick={() => fileRef.current?.click()} disabled={uploadPhoto.isPending}
                    className="px-3 py-1.5 bg-secondary text-secondary-foreground rounded-sm text-[12px] font-medium hover:bg-secondary/80 transition-colors flex items-center gap-1">
                    <Upload className="h-3 w-3" /> {uploadPhoto.isPending ? "Uploaden..." : "Foto wijzigen"}
                  </button>
                </div>
              </div>
              <div>
                <label className={labelClass}>Over</label>
                <input value={about} onChange={e => setAbout(e.target.value)} className={inputClass} placeholder="Korte beschrijving (max 139 tekens)" maxLength={139} />
              </div>
              <div>
                <label className={labelClass}>Beschrijving</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} className={`${inputClass} min-h-[60px]`} placeholder="Uitgebreide beschrijving" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Adres</label>
                  <input value={address} onChange={e => setAddress(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>E-mail</label>
                  <input value={email} onChange={e => setEmail(e.target.value)} className={inputClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Branche</label>
                <select value={vertical} onChange={e => setVertical(e.target.value)} className={inputClass}>
                  {VERTICALS.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              {/* Websites */}
              <div>
                <label className={labelClass}>Websites</label>
                {websites.map((w, i) => (
                  <div key={i} className="flex items-center gap-2 mb-1">
                    <input value={w} onChange={e => { const next = [...websites]; next[i] = e.target.value; setWebsites(next); }} className={inputClass} />
                    <button onClick={() => setWebsites(websites.filter((_, j) => j !== i))} className="text-destructive hover:text-destructive/80"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
                {websites.length < 2 && (
                  <div className="flex items-center gap-2">
                    <input value={newWebsite} onChange={e => setNewWebsite(e.target.value)} className={inputClass} placeholder="https://..." />
                    <button onClick={() => { if (newWebsite) { setWebsites([...websites, newWebsite]); setNewWebsite(""); } }}
                      className="px-2 py-2 bg-secondary text-secondary-foreground rounded-sm text-[12px] hover:bg-secondary/80"><Plus className="h-3.5 w-3.5" /></button>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveProfile} disabled={updateProfile.isPending}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-sm text-[12px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50">
                  {updateProfile.isPending ? "Opslaan..." : "Opslaan"}
                </button>
                <button onClick={() => setEditProfile(false)} className="px-4 py-2 bg-secondary text-secondary-foreground rounded-sm text-[12px] font-medium hover:bg-secondary/80 transition-colors">
                  Annuleren
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-3 mb-3">
                {profile?.profile_picture_url ? (
                  <img src={profile.profile_picture_url} alt="Profiel" className="h-12 w-12 rounded-full object-cover border border-border" />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center"><ImageIcon className="h-5 w-5 text-muted-foreground" /></div>
                )}
                <div className="text-[13px]">
                  {profile?.about && <p className="font-medium">{profile.about}</p>}
                  {profile?.vertical && profile.vertical !== "UNDEFINED" && <p className="text-muted-foreground text-[11px]">{profile.vertical}</p>}
                </div>
              </div>
              <div className="text-[13px] space-y-1">
                {profile?.description && <p><span className="text-muted-foreground">Beschrijving:</span> {profile.description}</p>}
                {profile?.email && <p><span className="text-muted-foreground">E-mail:</span> {profile.email}</p>}
                {profile?.address && <p><span className="text-muted-foreground">Adres:</span> {profile.address}</p>}
                {profile?.websites && profile.websites.length > 0 && (
                  <p><span className="text-muted-foreground">Websites:</span> {profile.websites.join(", ")}</p>
                )}
                {!profile?.about && !profile?.description && <p className="text-muted-foreground">Geen profielgegevens ingesteld.</p>}
              </div>
            </div>
          )
        )}
      </div>

      {/* Templates */}
      <div className="bg-card border border-border rounded-lg shadow-card p-5 md:p-6">
        <div className="flex items-center justify-between mb-3">
          <SectionHeader id="templates" title={`Berichttemplates${templates ? ` (${templates.length})` : ""}`} icon={MessageSquare} />
          {expandedSections.templates && (
            <button onClick={() => setShowCreateTemplate(!showCreateTemplate)}
              className="px-3 py-1.5 bg-primary text-primary-foreground rounded-sm text-[11px] font-bold hover:bg-primary-hover transition-colors flex items-center gap-1">
              <Plus className="h-3 w-3" /> Nieuw
            </button>
          )}
        </div>
        {expandedSections.templates && (
          <>
            {/* Create form */}
            {showCreateTemplate && (
              <div className="bg-background border border-border rounded-sm p-4 mb-3 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className={labelClass}>Naam</label>
                    <input value={tplName} onChange={e => setTplName(e.target.value)} className={inputClass} placeholder="mijn_template" />
                  </div>
                  <div>
                    <label className={labelClass}>Categorie</label>
                    <select value={tplCategory} onChange={e => setTplCategory(e.target.value)} className={inputClass}>
                      <option value="UTILITY">Utility</option>
                      <option value="MARKETING">Marketing</option>
                      <option value="AUTHENTICATION">Authentication</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Berichttekst</label>
                  <textarea value={tplBody} onChange={e => setTplBody(e.target.value)} className={`${inputClass} min-h-[80px]`}
                    placeholder="Hallo {{1}}, uw afspraak is bevestigd voor {{2}}." />
                  <p className="text-[10px] text-muted-foreground mt-1">Gebruik {"{{1}}"}, {"{{2}}"} etc. voor variabelen. Taal: Nederlands (nl).</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleCreateTemplate} disabled={createTemplate.isPending || !tplName || !tplBody}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-sm text-[12px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50">
                    {createTemplate.isPending ? "Aanmaken..." : "Aanmaken"}
                  </button>
                  <button onClick={() => setShowCreateTemplate(false)} className="px-4 py-2 bg-secondary text-secondary-foreground rounded-sm text-[12px] font-medium">
                    Annuleren
                  </button>
                </div>
              </div>
            )}
            {templatesLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : !templates || templates.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">Geen templates gevonden.</p>
            ) : (
              <div className="space-y-1.5">
                {templates.map((t) => (
                  <div key={t.name} className="flex items-center justify-between p-2.5 border border-border rounded-sm bg-background group">
                    <div className="flex items-center gap-2 min-w-0">
                      <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[13px] font-medium block truncate">{t.name}</span>
                        <span className="text-[10px] text-muted-foreground">{t.category} · {t.language}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${t.status === "APPROVED" ? "bg-success/10 text-success" : t.status === "REJECTED" ? "bg-destructive/10 text-destructive" : "bg-secondary text-secondary-foreground"}`}>
                        {t.status}
                      </span>
                      <button onClick={() => handleDeleteTemplate(t.name)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SettingsWhatsAppTab;
