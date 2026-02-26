import { useState, useEffect, FormEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Pencil, Trash2, CheckCircle, XCircle, Upload, UserPlus, Users, MessageSquare, ChevronDown, ChevronUp, BookOpen, AlertTriangle, HelpCircle } from "lucide-react";
import { useWhatsAppStatus } from "@/hooks/useWhatsAppStatus";
import { useWhatsAppTemplates, useDeleteWhatsAppTemplate, useCreateWhatsAppTemplate } from "@/hooks/useWhatsAppTemplates";
import { useWhatsAppProfile, useUpdateWhatsAppProfile, useUploadWhatsAppProfilePhoto } from "@/hooks/useWhatsAppProfile";
import { useQueryClient } from "@tanstack/react-query";
import { useServices, useDeleteService } from "@/hooks/useCustomers";
import { useSyncAllContactsEboekhouden, useSyncAllInvoicesEboekhouden, usePullContactsEboekhouden, usePullInvoicesEboekhouden, usePullInvoiceStatusEboekhouden } from "@/hooks/useInvoices";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ServiceDialog from "@/components/ServiceDialog";
import TemplateDialog from "@/components/TemplateDialog";
import { useQuoteTemplatesDB, useDeleteQuoteTemplate, useCombinedTemplates, type QuoteTemplateDB } from "@/hooks/useQuoteTemplates";
import { useWhatsAppAutomations, useCreateAutomation, useUpdateAutomation, useDeleteAutomation, TRIGGER_TYPES, AVAILABLE_VARIABLES } from "@/hooks/useWhatsAppAutomations";
import type { Tables } from "@/integrations/supabase/types";

const tabs = ["Profiel", "Bedrijfsgegevens", "App-voorkeuren", "Diensten", "Sjablonen", "e-Boekhouden", "WhatsApp", "Automatiseringen", "Teamleden"];

const SettingsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState(0);
  const [waGuideOpen, setWaGuideOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [location, setLocation] = useState("");
  const [kvkNumber, setKvkNumber] = useState("");
  const [btwNumber, setBtwNumber] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyPostalCode, setCompanyPostalCode] = useState("");
  const [companyCity, setCompanyCity] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [iban, setIban] = useState("");
  const [smtpEmail, setSmtpEmail] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpHost, setSmtpHost] = useState("smtp.transip.email");
  const [smtpPort, setSmtpPort] = useState("465");
  const [smtpHasCredentials, setSmtpHasCredentials] = useState(false);
  const [savingSmtp, setSavingSmtp] = useState(false);

  // Services tab state
  const { data: services, isLoading: servicesLoading } = useServices();
  const deleteService = useDeleteService();
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Tables<"services"> | null>(null);
  const [deletingServiceId, setDeletingServiceId] = useState<string | null>(null);

  // Templates tab state
  const { data: customTemplates, isLoading: templatesLoading } = useQuoteTemplatesDB();
  const { data: allTemplates } = useCombinedTemplates();
  const deleteTemplate = useDeleteQuoteTemplate();
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<QuoteTemplateDB | null>(null);
  const [editingStandardTemplate, setEditingStandardTemplate] = useState<{ name: string; items: any[]; optional_items: any[] } | null>(null);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [hidingStandardId, setHidingStandardId] = useState<string | null>(null);
  const [hiddenStandard, setHiddenStandard] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("hidden_standard_templates") || "[]"); } catch { return []; }
  });

  const hideStandardTemplate = (id: string) => {
    const next = [...hiddenStandard, id];
    setHiddenStandard(next);
    localStorage.setItem("hidden_standard_templates", JSON.stringify(next));
    toast({ title: "Standaard sjabloon verborgen" });
  };

  const visibleTemplates = allTemplates?.filter(t => !(!t.isCustom && hiddenStandard.includes(t.id))) ?? [];

  // e-Boekhouden state
  const [ebToken, setEbToken] = useState("");
  const [ebTemplateId, setEbTemplateId] = useState<string>("");
  const [ebLedgerId, setEbLedgerId] = useState<string>("");
  const [ebDebtorLedgerId, setEbDebtorLedgerId] = useState<string>("");
  const [ebTemplates, setEbTemplates] = useState<any[]>([]);
  const [ebLedgers, setEbLedgers] = useState<any[]>([]);
  const [ebDebtorLedgers, setEbDebtorLedgers] = useState<any[]>([]);
  const [ebSaving, setEbSaving] = useState(false);
  const [ebTesting, setEbTesting] = useState(false);
  const [ebConnected, setEbConnected] = useState<boolean | null>(null);
  const [ebLoadingOptions, setEbLoadingOptions] = useState(false);
  const syncAllContacts = useSyncAllContactsEboekhouden();
  const syncAllInvoices = useSyncAllInvoicesEboekhouden();
  const pullContacts = usePullContactsEboekhouden();
  const pullInvoices = usePullInvoicesEboekhouden();
  const pullInvoiceStatus = usePullInvoiceStatusEboekhouden();
  const [bulkSyncingContacts, setBulkSyncingContacts] = useState(false);
  const [bulkSyncingInvoices, setBulkSyncingInvoices] = useState(false);
  const [pullingContacts, setPullingContacts] = useState(false);
  const [pullingInvoices, setPullingInvoices] = useState(false);
  const [pullingStatus, setPullingStatus] = useState(false);

  // Team members state
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [teamRoles, setTeamRoles] = useState<Record<string, string>>({});
  const [teamLoading, setTeamLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("monteur");
  const [inviting, setInviting] = useState(false);
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);
  const [deletingMember, setDeletingMember] = useState(false);

  // WhatsApp status
  const queryClient = useQueryClient();
  const { data: waStatus } = useWhatsAppStatus();
  const { data: waTemplates } = useWhatsAppTemplates(activeTab === 6 && !!waStatus?.connected);
  const deleteWaTemplate = useDeleteWhatsAppTemplate();
  const createWaTemplate = useCreateWhatsAppTemplate();
  const [deletingWaTemplateName, setDeletingWaTemplateName] = useState<string | null>(null);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [newTplName, setNewTplName] = useState("");
  const [newTplCategory, setNewTplCategory] = useState("UTILITY");
  const [newTplLanguage, setNewTplLanguage] = useState("nl");
  const [newTplHeaderText, setNewTplHeaderText] = useState("");
  const [newTplBody, setNewTplBody] = useState("");
  const [newTplFooter, setNewTplFooter] = useState("");
  const [newTplButtons, setNewTplButtons] = useState<{ type: string; text: string; url?: string; phone_number?: string }[]>([]);

  // WhatsApp Business Profile
  const { data: waProfile, isLoading: waProfileLoading } = useWhatsAppProfile(activeTab === 6 && !!waStatus?.connected);
  const updateWaProfile = useUpdateWhatsAppProfile();
  const uploadWaPhoto = useUploadWhatsAppProfilePhoto();
  const [waProfileAbout, setWaProfileAbout] = useState("");
  const [waProfileDescription, setWaProfileDescription] = useState("");
  const [waProfileAddress, setWaProfileAddress] = useState("");
  const [waProfileEmail, setWaProfileEmail] = useState("");
  const [waProfileWebsite, setWaProfileWebsite] = useState("");
  const [waProfileVertical, setWaProfileVertical] = useState("");
  const [waProfileEditing, setWaProfileEditing] = useState(false);

  useEffect(() => {
    if (waProfile) {
      setWaProfileAbout(waProfile.about || "");
      setWaProfileDescription(waProfile.description || "");
      setWaProfileAddress(waProfile.address || "");
      setWaProfileEmail(waProfile.email || "");
      setWaProfileWebsite(waProfile.websites?.[0] || "");
      setWaProfileVertical(waProfile.vertical || "");
    }
  }, [waProfile]);

  // Automations state
  const { data: automations, isLoading: automationsLoading } = useWhatsAppAutomations();
  const createAutomation = useCreateAutomation();
  const updateAutomation = useUpdateAutomation();
  const deleteAutomation = useDeleteAutomation();
  const [autoDialogOpen, setAutoDialogOpen] = useState(false);
  const [autoName, setAutoName] = useState("");
  const [autoTrigger, setAutoTrigger] = useState("");
  const [autoTemplate, setAutoTemplate] = useState("");
  const [autoLanguage, setAutoLanguage] = useState("nl");
  const [autoCooldown, setAutoCooldown] = useState("720");
  const [autoMapping, setAutoMapping] = useState<Record<string, string>>({});
  const [deletingAutoId, setDeletingAutoId] = useState<string | null>(null);

  // Load team members when tab is active
  useEffect(() => {
    if (activeTab === 8) {
      loadTeamMembers();
    }
  }, [activeTab]);

  const loadTeamMembers = async () => {
    setTeamLoading(true);
    const [profilesRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: true }),
      supabase.from("user_roles").select("*"),
    ]);
    setTeamMembers(profilesRes.data ?? []);
    const roleMap: Record<string, string> = {};
    (rolesRes.data ?? []).forEach((r: any) => { roleMap[r.user_id] = r.role; });
    setTeamRoles(roleMap);
    setTeamLoading(false);
  };

  const handleInviteUser = async () => {
    if (!inviteEmail) return;
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: {
          email: inviteEmail,
          full_name: inviteName || undefined,
          redirect_url: window.location.origin + "/auth",
          role: inviteRole,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Uitnodiging verstuurd", description: `Een e-mail is verstuurd naar ${inviteEmail}` });
      setInviteEmail("");
      setInviteName("");
      setInviteRole("monteur");
      loadTeamMembers();
    } catch (err: any) {
      toast({ title: "Uitnodiging mislukt", description: err.message, variant: "destructive" });
    }
    setInviting(false);
  };

  const handleDeleteMember = async () => {
    if (!deletingMemberId) return;
    setDeletingMember(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: { action: "delete", user_id: deletingMemberId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Teamlid verwijderd" });
      setDeletingMemberId(null);
      loadTeamMembers();
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
    setDeletingMember(false);
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    try {
      // Upsert role
      const { error } = await supabase.from("user_roles").upsert(
        { user_id: userId, role: newRole } as any,
        { onConflict: "user_id,role" }
      );
      // If the role changed, delete old role first then insert new
      await supabase.from("user_roles").delete().eq("user_id", userId);
      await supabase.from("user_roles").insert({ user_id: userId, role: newRole } as any);
      setTeamRoles((prev) => ({ ...prev, [userId]: newRole }));
      toast({ title: "Rol bijgewerkt" });
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) {
        setFullName(data.full_name ?? "");
        setPhone(data.phone ?? "");
        setCompanyName(data.company_name ?? "");
        setLocation(data.location ?? "");
        setKvkNumber((data as any).kvk_number ?? "");
        setBtwNumber((data as any).btw_number ?? "");
        setCompanyAddress((data as any).company_address ?? "");
        setCompanyPostalCode((data as any).company_postal_code ?? "");
        setCompanyCity((data as any).company_city ?? "");
        setCompanyPhone((data as any).company_phone ?? "");
        setIban((data as any).iban ?? "");
        setSmtpEmail((data as any).smtp_email || user?.email || "");
        setSmtpHost((data as any).smtp_host || "smtp.transip.email");
        setSmtpPort(String((data as any).smtp_port || "465"));
        setSmtpHasCredentials(!!(data as any).smtp_email && !!(data as any).smtp_password);
        setEbTemplateId(String((data as any).eboekhouden_template_id ?? ""));
        setEbLedgerId(String((data as any).eboekhouden_ledger_id ?? ""));
        setEbDebtorLedgerId(String((data as any).eboekhouden_debtor_ledger_id ?? ""));
        setEbConnected(!!(data as any).eboekhouden_api_token);
      }
      setLoading(false);
    })();
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: fullName, phone }).eq("id", user.id);
    setSaving(false);
    if (error) {
      toast({ title: "Fout", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profiel opgeslagen" });
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: "Fout", description: "Wachtwoord moet minimaal 6 tekens bevatten", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Fout", description: "Wachtwoorden komen niet overeen", variant: "destructive" });
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) {
      toast({ title: "Fout", description: error.message, variant: "destructive" });
    } else {
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Wachtwoord gewijzigd" });
    }
  };

  const handleSaveCompany = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      company_name: companyName,
      location,
      kvk_number: kvkNumber,
      btw_number: btwNumber,
      company_address: companyAddress,
      company_postal_code: companyPostalCode,
      company_city: companyCity,
      company_phone: companyPhone,
      iban,
    } as any).eq("id", user.id);
    setSaving(false);
    if (error) {
      toast({ title: "Fout", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Bedrijfsgegevens opgeslagen" });
    }
  };

  const handleSaveSmtp = async () => {
    if (!user) return;
    setSavingSmtp(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Fout", description: "Niet ingelogd", variant: "destructive" });
        setSavingSmtp(false);
        return;
      }
      const res = await supabase.functions.invoke("save-smtp-credentials", {
        body: { smtp_email: smtpEmail, smtp_password: smtpPassword || undefined, smtp_host: smtpHost, smtp_port: parseInt(smtpPort) || 465 },
      });
      if (res.error) {
        toast({ title: "Fout", description: res.error.message, variant: "destructive" });
      } else if (res.data?.error) {
        toast({ title: "Fout", description: res.data.error, variant: "destructive" });
      } else {
        setSmtpPassword("");
        setSmtpHasCredentials(!!smtpEmail && (smtpHasCredentials || !!smtpPassword));
        toast({ title: "E-mailinstellingen opgeslagen" });
      }
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
    setSavingSmtp(false);
  };

  const handleResetOnboarding = async () => {
    if (!user) return;
    await supabase.from("profiles").update({ onboarding_completed: false }).eq("id", user.id);
    window.location.reload();
  };

  const handleDeleteService = async () => {
    if (!deletingServiceId) return;
    try {
      await deleteService.mutateAsync(deletingServiceId);
      toast({ title: "Dienst verwijderd" });
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
    setDeletingServiceId(null);
  };

  // e-Boekhouden handlers
  const saveEbTokenEncrypted = async (token: string) => {
    const res = await supabase.functions.invoke("save-smtp-credentials", {
      body: { eboekhouden_api_token: token },
    });
    if (res.error) throw res.error;
    if (res.data?.error) throw new Error(res.data.error);
  };

  const handleSaveEbToken = async () => {
    if (!user) return;
    setEbSaving(true);
    try {
      // Save token encrypted via edge function
      if (ebToken) {
        await saveEbTokenEncrypted(ebToken);
      }
      // Save template/ledger IDs directly (not sensitive)
      await supabase.from("profiles").update({
        eboekhouden_template_id: ebTemplateId ? Number(ebTemplateId) : null,
        eboekhouden_ledger_id: ebLedgerId ? Number(ebLedgerId) : null,
        eboekhouden_debtor_ledger_id: ebDebtorLedgerId ? Number(ebDebtorLedgerId) : null,
      } as any).eq("id", user.id);
      setEbConnected(!!ebToken);
      toast({ title: "e-Boekhouden instellingen opgeslagen" });
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
    setEbSaving(false);
  };

  const handleTestEb = async () => {
    setEbTesting(true);
    setEbConnected(null);
    try {
      // Save token encrypted first
      if (ebToken) await saveEbTokenEncrypted(ebToken);
      const { data, error } = await supabase.functions.invoke("sync-invoice-eboekhouden", {
        body: { action: "test" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setEbConnected(true);
      toast({ title: "Verbinding geslaagd!", description: "e-Boekhouden is bereikbaar." });
    } catch (err: any) {
      setEbConnected(false);
      toast({ title: "Verbinding mislukt", description: err.message, variant: "destructive" });
    }
    setEbTesting(false);
  };

  const handleLoadEbOptions = async () => {
    setEbLoadingOptions(true);
    try {
      // Save token encrypted first
      if (ebToken) await saveEbTokenEncrypted(ebToken);
      const [templatesRes, ledgersRes, debtorLedgersRes] = await Promise.all([
        supabase.functions.invoke("sync-invoice-eboekhouden", { body: { action: "templates" } }),
        supabase.functions.invoke("sync-invoice-eboekhouden", { body: { action: "ledgers" } }),
        supabase.functions.invoke("sync-invoice-eboekhouden", { body: { action: "debtor-ledgers" } }),
      ]);
      if (templatesRes.error) throw templatesRes.error;
      if (ledgersRes.error) throw ledgersRes.error;
      if (debtorLedgersRes.error) throw debtorLedgersRes.error;
      if (templatesRes.data?.error) throw new Error(templatesRes.data.error);
      if (ledgersRes.data?.error) throw new Error(ledgersRes.data.error);
      if (debtorLedgersRes.data?.error) throw new Error(debtorLedgersRes.data.error);
      const tData = templatesRes.data;
      const lData = ledgersRes.data;
      const dData = debtorLedgersRes.data;
      setEbTemplates(tData?.items ?? (Array.isArray(tData) ? tData : []));
      setEbLedgers(lData?.items ?? (Array.isArray(lData) ? lData : []));
      const debtorItems = dData?.items ?? (Array.isArray(dData) ? dData : []);
      setEbDebtorLedgers(debtorItems);
      // Auto-select first debtor ledger if not yet set
      if (!ebDebtorLedgerId && debtorItems.length > 0) {
        setEbDebtorLedgerId(String(debtorItems[0].id));
      }
    } catch (err: any) {
      toast({ title: "Fout bij ophalen", description: err.message, variant: "destructive" });
    }
    setEbLoadingOptions(false);
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const inputClass = "w-full px-3.5 py-2.5 bg-background border border-border rounded-sm text-[13.5px] placeholder:text-t3 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors";
  const labelClass = "block text-[12px] font-bold text-secondary-foreground mb-1.5";

  return (
    <div className="max-w-2xl">
      <div className="flex gap-0 border-b-2 border-border mb-5 overflow-x-auto scrollbar-hide">
        {tabs.map((t, i) => (
          <button key={t} onClick={() => setActiveTab(i)} className={`px-4 md:px-5 py-2.5 text-[12px] md:text-[13px] font-bold border-b-2 -mb-[2px] transition-colors whitespace-nowrap ${i === activeTab ? "text-primary border-primary" : "text-t3 border-transparent hover:text-secondary-foreground"}`}>
            {t}
          </button>
        ))}
      </div>

      {activeTab === 0 && (
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
          <button onClick={handleSaveProfile} disabled={saving} className="px-5 py-2.5 bg-primary text-primary-foreground rounded-sm text-[13px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50">
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
              <button
                onClick={handleChangePassword}
                disabled={changingPassword || !newPassword || !confirmPassword}
                className="px-5 py-2.5 bg-primary text-primary-foreground rounded-sm text-[13px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50"
              >
                {changingPassword ? "Wijzigen..." : "Wachtwoord wijzigen"}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 1 && (
        <div className="bg-card border border-border rounded-lg shadow-card p-5 md:p-6 space-y-4">
          <div>
            <label className={labelClass}>Bedrijfsnaam</label>
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputClass} placeholder="MV Solutions" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>KvK-nummer</label>
              <input value={kvkNumber} onChange={(e) => setKvkNumber(e.target.value)} className={inputClass} placeholder="12345678" />
            </div>
            <div>
              <label className={labelClass}>BTW-nummer</label>
              <input value={btwNumber} onChange={(e) => setBtwNumber(e.target.value)} className={inputClass} placeholder="NL123456789B01" />
            </div>
          </div>
          <div>
            <label className={labelClass}>Adres</label>
            <input value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} className={inputClass} placeholder="Straatnaam 1" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Postcode</label>
              <input value={companyPostalCode} onChange={(e) => setCompanyPostalCode(e.target.value)} className={inputClass} placeholder="1234 AB" />
            </div>
            <div>
              <label className={labelClass}>Plaats</label>
              <input value={companyCity} onChange={(e) => setCompanyCity(e.target.value)} className={inputClass} placeholder="Heemskerk" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Telefoon</label>
              <input value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} className={inputClass} placeholder="06-12345678" />
            </div>
            <div>
              <label className={labelClass}>IBAN</label>
              <input value={iban} onChange={(e) => setIban(e.target.value)} className={inputClass} placeholder="NL00BANK0123456789" />
            </div>
          </div>
          <div>
            <label className={labelClass}>Vestigingsplaats (voor routeberekening)</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} className={inputClass} placeholder="Heemskerk" />
          </div>
          <button onClick={handleSaveCompany} disabled={saving} className="px-5 py-2.5 bg-primary text-primary-foreground rounded-sm text-[13px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50">
            {saving ? "Opslaan..." : "Opslaan"}
          </button>
        </div>
      )}

      {activeTab === 2 && (
        <div className="bg-card border border-border rounded-lg shadow-card p-5 md:p-6 space-y-5">
          <div>
            <h3 className="text-[14px] font-bold mb-1">Rondleiding</h3>
            <p className="text-[12px] text-secondary-foreground mb-3">Bekijk de introductie-rondleiding opnieuw.</p>
            <button onClick={handleResetOnboarding} className="px-4 py-2 bg-card border border-border rounded-sm text-[12px] font-bold text-secondary-foreground hover:bg-bg-hover transition-colors">
              🔄 Rondleiding opnieuw starten
            </button>
          </div>
          <div className="border-t border-border pt-5">
            <h3 className="text-[14px] font-bold mb-1">E-mail (SMTP)</h3>
            <p className="text-[12px] text-secondary-foreground mb-3">Stel je e-mailgegevens in om e-mails te versturen vanuit de communicatiemodule.</p>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>E-mailadres</label>
                <input value={smtpEmail} onChange={(e) => setSmtpEmail(e.target.value)} className={inputClass} placeholder="info@jouwdomein.nl" type="email" />
              </div>
              <div>
                <label className={labelClass}>Wachtwoord</label>
                <input value={smtpPassword} onChange={(e) => setSmtpPassword(e.target.value)} className={inputClass} placeholder={smtpHasCredentials ? "••••••••  (ongewijzigd)" : "Wachtwoord"} type="password" />
                {smtpHasCredentials && !smtpPassword && (
                  <p className="text-[11px] text-t3 mt-1">Laat leeg om het huidige wachtwoord te behouden</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>SMTP Server</label>
                  <input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} className={inputClass} placeholder="smtp.transip.email" />
                </div>
                <div>
                  <label className={labelClass}>Poort</label>
                  <input value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} className={inputClass} placeholder="465" type="number" />
                </div>
              </div>
              <div className="text-[11px] text-t3">SSL/TLS wordt automatisch gebruikt</div>
              <button onClick={handleSaveSmtp} disabled={savingSmtp} className="px-5 py-2.5 bg-primary text-primary-foreground rounded-sm text-[13px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50">
                {savingSmtp ? "Opslaan..." : "E-mail opslaan"}
              </button>
              {smtpHasCredentials && (
                <p className="text-[11px] text-success font-bold">✓ E-mailgegevens zijn ingesteld</p>
              )}
            </div>
          </div>
          <div className="border-t border-border pt-5">
            <h3 className="text-[14px] font-bold mb-1">PWA Installatie</h3>
            <p className="text-[12px] text-secondary-foreground mb-3">Installeer VentFlow als app op je telefoon voor snelle toegang.</p>
            <div className="text-[12px] text-secondary-foreground space-y-1">
              <p><strong>iOS:</strong> Tik op het deel-icoon → "Zet op beginscherm"</p>
              <p><strong>Android:</strong> Tik op het menu (⋮) → "Toevoegen aan startscherm"</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 3 && (
        <div className="bg-card border border-border rounded-lg shadow-card p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[14px] font-bold">Diensten</h3>
            <Button size="sm" onClick={() => { setEditingService(null); setServiceDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Nieuwe dienst
            </Button>
          </div>
          {servicesLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : !services?.length ? (
            <p className="text-[13px] text-muted-foreground text-center py-8">Nog geen diensten. Voeg je eerste dienst toe.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Naam</TableHead>
                  <TableHead>Categorie</TableHead>
                  <TableHead className="text-right">Prijs (incl.)</TableHead>
                  <TableHead className="text-right">Duur</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: s.color || "#64748b" }} />
                    </TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-muted-foreground">{s.category || "—"}</TableCell>
                    <TableCell className="text-right">€{Number(s.price).toFixed(2)}</TableCell>
                    <TableCell className="text-right">{(s as any).duration_minutes ?? 60} min</TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingService(s); setServiceDialogOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeletingServiceId(s.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {activeTab === 4 && (
        <div className="bg-card border border-border rounded-lg shadow-card p-5 md:p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[14px] font-bold mb-1">Offerte / Factuur sjablonen</h3>
              <p className="text-[12px] text-secondary-foreground">Beheer je eigen sjablonen voor offertes en facturen.</p>
            </div>
            <Button size="sm" onClick={() => { setEditingTemplate(null); setEditingStandardTemplate(null); setTemplateDialogOpen(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Nieuw sjabloon
            </Button>
          </div>

          {templatesLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : !visibleTemplates.length ? (
            <p className="text-[13px] text-muted-foreground text-center py-6">Geen sjablonen gevonden.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Naam</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Artikelen</TableHead>
                  <TableHead>Optioneel</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleTemplates.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full ${t.isCustom ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {t.isCustom ? "★ Aangepast" : "Standaard"}
                      </span>
                    </TableCell>
                    <TableCell>{t.items.length}</TableCell>
                    <TableCell>{t.optionalItems.length}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                          if (t.isCustom) {
                            const dbTpl = customTemplates?.find(ct => ct.id === t.id);
                            if (dbTpl) { setEditingTemplate(dbTpl); setEditingStandardTemplate(null); setTemplateDialogOpen(true); }
                          } else {
                            setEditingTemplate(null);
                            setEditingStandardTemplate({ name: t.name, items: t.items, optional_items: t.optionalItems });
                            setTemplateDialogOpen(true);
                          }
                        }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => {
                          if (t.isCustom) {
                            setDeletingTemplateId(t.id);
                          } else {
                            setHidingStandardId(t.id);
                          }
                        }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {hiddenStandard.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => { setHiddenStandard([]); localStorage.removeItem("hidden_standard_templates"); }}>
              Verborgen standaard sjablonen herstellen ({hiddenStandard.length})
            </Button>
          )}
        </div>
      )}

      {activeTab === 5 && (
        <div className="bg-card border border-border rounded-lg shadow-card p-5 md:p-6 space-y-5">
          <div>
            <h3 className="text-[14px] font-bold mb-1">e-Boekhouden koppeling</h3>
            <p className="text-[12px] text-secondary-foreground mb-3">Koppel je e-Boekhouden account om facturen automatisch te boeken.</p>
          </div>

          <div>
            <label className={labelClass}>API-token</label>
            <input
              value={ebToken}
              onChange={(e) => setEbToken(e.target.value)}
              className={inputClass}
              placeholder={ebConnected ? "••••••••  (ongewijzigd – vul in om te wijzigen)" : "Plak hier je e-Boekhouden API-token"}
              type="password"
            />
            <p className="text-[11px] text-t3 mt-1">Aan te maken via Instellingen in je e-Boekhouden account</p>
            {ebConnected && !ebToken && (
              <p className="text-[11px] text-t3 mt-0.5">Laat leeg om de huidige token te behouden</p>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleTestEb}
              disabled={(!ebToken && !ebConnected) || ebTesting}
              className="px-4 py-2 bg-card border border-border rounded-sm text-[12px] font-bold text-secondary-foreground hover:bg-bg-hover transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {ebTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              🔌 Test verbinding
            </button>
            <button
              onClick={handleLoadEbOptions}
              disabled={(!ebToken && !ebConnected) || ebLoadingOptions}
              className="px-4 py-2 bg-card border border-border rounded-sm text-[12px] font-bold text-secondary-foreground hover:bg-bg-hover transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {ebLoadingOptions ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              📥 Sjablonen & rekeningen ophalen
            </button>
          </div>

          {ebConnected !== null && (
            <div className={`flex items-center gap-1.5 text-[12px] font-bold ${ebConnected ? "text-success" : "text-destructive"}`}>
              {ebConnected ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {ebConnected ? "Verbonden met e-Boekhouden" : "Verbinding mislukt"}
            </div>
          )}

          {(ebTemplates.length > 0 || ebLedgers.length > 0 || ebDebtorLedgers.length > 0) && (
            <div className="border-t border-border pt-4 space-y-4">
              {ebTemplates.length > 0 && (
                <div>
                  <label className={labelClass}>Factuursjabloon</label>
                  <Select value={ebTemplateId} onValueChange={setEbTemplateId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Kies een sjabloon" />
                    </SelectTrigger>
                    <SelectContent>
                      {ebTemplates.map((t: any) => (
                        <SelectItem key={t.id} value={String(t.id)}>{t.name || `Sjabloon ${t.id}`}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {ebLedgers.length > 0 && (
                <div>
                  <label className={labelClass}>Grootboekrekening (omzet)</label>
                  <Select value={ebLedgerId} onValueChange={setEbLedgerId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Kies een grootboekrekening" />
                    </SelectTrigger>
                    <SelectContent>
                      {ebLedgers.map((l: any) => (
                        <SelectItem key={l.id} value={String(l.id)}>{l.code} – {l.description || l.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {ebDebtorLedgers.length > 0 && (
                <div>
                  <label className={labelClass}>Debiteurenrekening</label>
                  <Select value={ebDebtorLedgerId} onValueChange={setEbDebtorLedgerId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Kies een debiteurenrekening" />
                    </SelectTrigger>
                    <SelectContent>
                      {ebDebtorLedgers.map((l: any) => (
                        <SelectItem key={l.id} value={String(l.id)}>{l.code} – {l.description || l.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleSaveEbToken}
            disabled={ebSaving}
            className="px-5 py-2.5 bg-primary text-primary-foreground rounded-sm text-[13px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            {ebSaving ? "Opslaan..." : "Opslaan"}
          </button>

          {ebConnected && (
            <div className="border-t border-border pt-5 space-y-3">
              <div>
                <h3 className="text-[14px] font-bold mb-1">Factuursjabloon (RTF)</h3>
                <p className="text-[12px] text-secondary-foreground mb-2">Download een RTF-sjabloon met e-Boekhouden veldcodes om te uploaden in je e-Boekhouden account.</p>
                <button
                  onClick={() => {
                    import("@/utils/generateInvoiceRtf").then(m => m.downloadInvoiceRtf());
                    toast({ title: "RTF sjabloon gedownload" });
                  }}
                  className="px-4 py-2 bg-card border border-border rounded-sm text-[12px] font-bold text-secondary-foreground hover:bg-bg-hover transition-colors flex items-center gap-1.5"
                >
                  📄 RTF sjabloon downloaden
                </button>
              </div>
              <h3 className="text-[14px] font-bold">Bulk synchronisatie</h3>
              <p className="text-[12px] text-secondary-foreground">Synchroniseer alle bestaande contacten en facturen naar e-Boekhouden.</p>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={async () => {
                    setBulkSyncingContacts(true);
                    try {
                      const result = await syncAllContacts.mutateAsync();
                      toast({
                        title: `Contacten gesynchroniseerd`,
                        description: `${result.synced} gesynct, ${result.skipped} overgeslagen${result.errors.length ? `, ${result.errors.length} fouten` : ""}`,
                        variant: result.errors.length ? "destructive" : "default",
                      });
                      if (result.errors.length) console.warn("Sync errors:", result.errors);
                    } catch (err: any) {
                      toast({ title: "Fout", description: err.message, variant: "destructive" });
                    }
                    setBulkSyncingContacts(false);
                  }}
                  disabled={bulkSyncingContacts || bulkSyncingInvoices}
                  className="px-4 py-2 bg-card border border-border rounded-sm text-[12px] font-bold text-secondary-foreground hover:bg-bg-hover transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {bulkSyncingContacts ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Alle contacten synchroniseren
                </button>
                <button
                  onClick={async () => {
                    setBulkSyncingInvoices(true);
                    try {
                      const result = await syncAllInvoices.mutateAsync();
                      toast({
                        title: `Facturen gesynchroniseerd`,
                        description: `${result.synced} gesynct, ${result.skipped} overgeslagen${result.errors.length ? `, ${result.errors.length} fouten` : ""}`,
                        variant: result.errors.length ? "destructive" : "default",
                      });
                      if (result.errors.length) console.warn("Sync errors:", result.errors);
                    } catch (err: any) {
                      toast({ title: "Fout", description: err.message, variant: "destructive" });
                    }
                    setBulkSyncingInvoices(false);
                  }}
                  disabled={bulkSyncingContacts || bulkSyncingInvoices}
                  className="px-4 py-2 bg-card border border-border rounded-sm text-[12px] font-bold text-secondary-foreground hover:bg-bg-hover transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {bulkSyncingInvoices ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Alle facturen synchroniseren
                </button>
              </div>
              <h3 className="text-[14px] font-bold mt-5">Data ophalen uit e-Boekhouden</h3>
              <p className="text-[12px] text-secondary-foreground">Haal contacten en facturen op uit e-Boekhouden naar deze app.</p>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={async () => {
                    setPullingContacts(true);
                    try {
                      const result = await pullContacts.mutateAsync();
                      toast({
                        title: `Contacten opgehaald`,
                        description: `${result.created} nieuw, ${result.updated} bijgewerkt (${result.total} totaal)${result.errors.length ? `, ${result.errors.length} fouten` : ""}`,
                        variant: result.errors.length ? "destructive" : "default",
                      });
                      if (result.errors.length) console.warn("Pull errors:", result.errors);
                    } catch (err: any) {
                      toast({ title: "Fout", description: err.message, variant: "destructive" });
                    }
                    setPullingContacts(false);
                  }}
                  disabled={pullingContacts || pullingInvoices}
                  className="px-4 py-2 bg-card border border-border rounded-sm text-[12px] font-bold text-secondary-foreground hover:bg-bg-hover transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {pullingContacts ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <>📥</>}
                  Contacten ophalen
                </button>
                <button
                  onClick={async () => {
                    setPullingInvoices(true);
                    try {
                      const result = await pullInvoices.mutateAsync();
                      toast({
                        title: `Facturen opgehaald`,
                        description: `${result.total_in_eboekhouden} in e-Boekhouden, ${result.already_imported} al gekoppeld, ${result.imported} nieuw geïmporteerd, ${result.skipped_no_customer} overgeslagen (geen klant)`,
                      });
                      if (result.skipped_invoices.length > 0) {
                        console.info("Overgeslagen facturen:", result.skipped_invoices);
                      }
                    } catch (err: any) {
                      toast({ title: "Fout", description: err.message, variant: "destructive" });
                    }
                    setPullingInvoices(false);
                  }}
                  disabled={pullingContacts || pullingInvoices}
                  className="px-4 py-2 bg-card border border-border rounded-sm text-[12px] font-bold text-secondary-foreground hover:bg-bg-hover transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {pullingInvoices ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <>📥</>}
                  Facturen ophalen
                </button>
                <button
                  onClick={async () => {
                    setPullingStatus(true);
                    try {
                      const result = await pullInvoiceStatus.mutateAsync();
                      toast({
                        title: `Betaalstatus bijgewerkt`,
                        description: `${result.checked} facturen gecontroleerd, ${result.updated} als betaald gemarkeerd`,
                      });
                    } catch (err: any) {
                      toast({ title: "Fout", description: err.message, variant: "destructive" });
                    }
                    setPullingStatus(false);
                  }}
                  disabled={pullingContacts || pullingInvoices || pullingStatus}
                  className="px-4 py-2 bg-card border border-border rounded-sm text-[12px] font-bold text-secondary-foreground hover:bg-bg-hover transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {pullingStatus ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <>💰</>}
                  Betaalstatus ophalen
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 6 && (
        <div className="bg-card border border-border rounded-lg shadow-card p-5 md:p-6 space-y-5">
          <div>
            <h3 className="text-[14px] font-bold mb-1 flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4" /> WhatsApp Business
            </h3>
            <p className="text-[12px] text-secondary-foreground mb-3">Koppel WhatsApp om berichten te versturen en ontvangen via de communicatiemodule.</p>
          </div>

          {waStatus?.connected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-1.5 text-[12px] font-bold text-success">
                <CheckCircle className="h-4 w-4" />
                Verbonden{waStatus.phone ? ` — ${waStatus.phone}` : ""}
              </div>

              {waTemplates && waTemplates.length > 0 && (
                <div className="border-t border-border pt-4">
                  <h4 className="text-[13px] font-bold mb-2">Templates ({waTemplates.length})</h4>
                  <div className="space-y-1.5">
                    {waTemplates.map((t: any) => (
                      <div key={t.name + t.language} className="flex items-center justify-between py-1.5 border-b border-border last:border-b-0 text-[12px]">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">{t.name}</span>
                          <span className="text-muted-foreground text-[10px]">
                            {t.category} · {t.language}
                            {t.parameter_format && ` · ${t.parameter_format}`}
                            {t.quality_score?.score && ` · Kwaliteit: ${t.quality_score.score}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex px-2 py-[2px] rounded-full text-[10px] font-bold ${
                            t.status === "APPROVED"
                              ? "bg-success-muted text-success"
                              : t.status === "PENDING"
                              ? "bg-warning-muted text-warning"
                              : "bg-destructive/10 text-destructive"
                          }`}>
                            {t.status}
                          </span>
                          <button
                            onClick={() => setDeletingWaTemplateName(t.name)}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                            title="Template verwijderen"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Create template */}
              <div className="border-t border-border pt-4">
                {!showCreateTemplate ? (
                  <button
                    onClick={() => { setShowCreateTemplate(true); setNewTplName(""); setNewTplBody(""); setNewTplHeaderText(""); setNewTplFooter(""); setNewTplButtons([]); setNewTplCategory("UTILITY"); setNewTplLanguage("nl"); }}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-sm text-[12px] font-bold hover:bg-primary-hover transition-colors flex items-center gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" /> Template aanmaken
                  </button>
                ) : (
                  <div className="border border-primary/30 rounded-md p-4 bg-primary/5 space-y-3">
                    <h4 className="text-[13px] font-bold">Nieuwe template aanmaken</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className={labelClass}>Naam (kleine letters, underscores)</label>
                        <input
                          value={newTplName}
                          onChange={(e) => setNewTplName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                          className={inputClass}
                          placeholder="bijv. afspraak_bevestiging"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Categorie</label>
                        <Select value={newTplCategory} onValueChange={setNewTplCategory}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="UTILITY">Utility</SelectItem>
                            <SelectItem value="MARKETING">Marketing</SelectItem>
                            <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className={labelClass}>Taal</label>
                        <Select value={newTplLanguage} onValueChange={setNewTplLanguage}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="nl">Nederlands (nl)</SelectItem>
                            <SelectItem value="en">English (en)</SelectItem>
                            <SelectItem value="de">Deutsch (de)</SelectItem>
                            <SelectItem value="fr">Français (fr)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Header (optioneel)</label>
                      <input value={newTplHeaderText} onChange={(e) => setNewTplHeaderText(e.target.value)} className={inputClass} placeholder="Bijv. Afspraakbevestiging" />
                    </div>
                    <div>
                      <label className={labelClass}>Body (verplicht) — gebruik {"{{1}}"} {"{{2}}"} voor variabelen</label>
                      <textarea
                        value={newTplBody}
                        onChange={(e) => setNewTplBody(e.target.value)}
                        className={`${inputClass} min-h-[100px]`}
                        placeholder={"Beste {{1}},\n\nUw afspraak is bevestigd op {{2}} om {{3}}.\n\nMet vriendelijke groet"}
                      />
                      {newTplBody && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Gevonden variabelen: {[...newTplBody.matchAll(/\{\{(\d+)\}\}/g)].map(m => `{{${m[1]}}}`).join(", ") || "geen"}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className={labelClass}>Footer (optioneel)</label>
                      <input value={newTplFooter} onChange={(e) => setNewTplFooter(e.target.value)} className={inputClass} placeholder="Bijv. Verzonden via VentFlow" />
                    </div>

                    {/* Buttons */}
                    <div>
                      <label className={labelClass}>Knoppen (optioneel, max 3)</label>
                      <div className="space-y-2">
                        {newTplButtons.map((btn, i) => (
                          <div key={i} className="flex items-center gap-2 text-[12px]">
                            <Select value={btn.type} onValueChange={(v) => {
                              const updated = [...newTplButtons];
                              updated[i] = { ...btn, type: v };
                              setNewTplButtons(updated);
                            }}>
                              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="QUICK_REPLY">Quick Reply</SelectItem>
                                <SelectItem value="URL">URL</SelectItem>
                                <SelectItem value="PHONE_NUMBER">Bellen</SelectItem>
                              </SelectContent>
                            </Select>
                            <input
                              value={btn.text}
                              onChange={(e) => { const u = [...newTplButtons]; u[i] = { ...btn, text: e.target.value }; setNewTplButtons(u); }}
                              className={`${inputClass} flex-1`}
                              placeholder="Knoptekst"
                            />
                            {btn.type === "URL" && (
                              <input
                                value={btn.url || ""}
                                onChange={(e) => { const u = [...newTplButtons]; u[i] = { ...btn, url: e.target.value }; setNewTplButtons(u); }}
                                className={`${inputClass} flex-1`}
                                placeholder="https://..."
                              />
                            )}
                            {btn.type === "PHONE_NUMBER" && (
                              <input
                                value={btn.phone_number || ""}
                                onChange={(e) => { const u = [...newTplButtons]; u[i] = { ...btn, phone_number: e.target.value }; setNewTplButtons(u); }}
                                className={`${inputClass} flex-1`}
                                placeholder="+31612345678"
                              />
                            )}
                            <button onClick={() => setNewTplButtons(newTplButtons.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                        {newTplButtons.length < 3 && (
                          <button
                            onClick={() => setNewTplButtons([...newTplButtons, { type: "QUICK_REPLY", text: "" }])}
                            className="text-[11px] text-primary font-bold hover:underline"
                          >
                            + Knop toevoegen
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={async () => {
                          if (!newTplName || !newTplBody) {
                            toast({ title: "Vul minimaal naam en body in", variant: "destructive" });
                            return;
                          }
                          try {
                            const components: any[] = [];
                            if (newTplHeaderText) {
                              components.push({ type: "HEADER", format: "TEXT", text: newTplHeaderText });
                            }
                            components.push({ type: "BODY", text: newTplBody });
                            if (newTplFooter) {
                              components.push({ type: "FOOTER", text: newTplFooter });
                            }
                            if (newTplButtons.length > 0) {
                              components.push({
                                type: "BUTTONS",
                                buttons: newTplButtons.map(b => {
                                  if (b.type === "QUICK_REPLY") return { type: "QUICK_REPLY", text: b.text };
                                  if (b.type === "URL") return { type: "URL", text: b.text, url: b.url };
                                  if (b.type === "PHONE_NUMBER") return { type: "PHONE_NUMBER", text: b.text, phone_number: b.phone_number };
                                  return { type: b.type, text: b.text };
                                }),
                              });
                            }
                            await createWaTemplate.mutateAsync({
                              name: newTplName,
                              category: newTplCategory,
                              language: newTplLanguage,
                              components,
                            });
                            toast({ title: "Template ingediend bij Meta", description: "Het kan enkele minuten duren voor de template is goedgekeurd." });
                            setShowCreateTemplate(false);
                          } catch (err: any) {
                            toast({ title: "Template aanmaken mislukt", description: err.message, variant: "destructive" });
                          }
                        }}
                        disabled={!newTplName || !newTplBody || createWaTemplate.isPending}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-sm text-[12px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50"
                      >
                        {createWaTemplate.isPending ? "Indienen..." : "Template indienen"}
                      </button>
                      <button onClick={() => setShowCreateTemplate(false)} className="px-4 py-2 bg-card border border-border rounded-sm text-[12px] font-bold text-secondary-foreground hover:bg-bg-hover transition-colors">
                        Annuleren
                      </button>
                    </div>
                  </div>
                )}
              </div>


              <AlertDialog open={!!deletingWaTemplateName} onOpenChange={() => setDeletingWaTemplateName(null)}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Template verwijderen?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Template "{deletingWaTemplateName}" wordt permanent verwijderd bij Meta. Dit kan niet ongedaan worden gemaakt.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuleren</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={async () => {
                        if (!deletingWaTemplateName) return;
                        try {
                          await deleteWaTemplate.mutateAsync(deletingWaTemplateName);
                          toast({ title: "Template verwijderd" });
                        } catch (err: any) {
                          toast({ title: "Verwijderen mislukt", description: err.message, variant: "destructive" });
                        }
                        setDeletingWaTemplateName(null);
                      }}
                    >
                      Verwijderen
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* Business Profile Section */}
              <div className="border-t border-border pt-4">
                <h4 className="text-[13px] font-bold mb-3">Bedrijfsprofiel</h4>
                {waProfileLoading ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                ) : (
                  <div className="space-y-3">
                    {waProfile?.profile_picture_url && (
                      <div className="flex items-center gap-3">
                        <img src={waProfile.profile_picture_url} alt="Profielfoto" className="w-14 h-14 rounded-full object-cover border border-border" />
                        <label className="cursor-pointer px-3 py-1.5 bg-card border border-border rounded-sm text-[11px] font-bold text-secondary-foreground hover:bg-bg-hover transition-colors">
                          📷 Wijzig foto
                          <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              await uploadWaPhoto.mutateAsync(file);
                              toast({ title: "Profielfoto bijgewerkt" });
                            } catch (err: any) {
                              toast({ title: "Fout", description: err.message, variant: "destructive" });
                            }
                          }} />
                        </label>
                        {uploadWaPhoto.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                      </div>
                    )}
                    {!waProfile?.profile_picture_url && (
                      <label className="cursor-pointer inline-flex px-3 py-1.5 bg-card border border-border rounded-sm text-[11px] font-bold text-secondary-foreground hover:bg-bg-hover transition-colors">
                        📷 Profielfoto uploaden
                        <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            await uploadWaPhoto.mutateAsync(file);
                            toast({ title: "Profielfoto bijgewerkt" });
                          } catch (err: any) {
                            toast({ title: "Fout", description: err.message, variant: "destructive" });
                          }
                        }} />
                      </label>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>Over (max 139 tekens)</label>
                        <input value={waProfileAbout} onChange={(e) => { setWaProfileAbout(e.target.value); setWaProfileEditing(true); }} className={inputClass} maxLength={139} placeholder="Korte omschrijving" />
                      </div>
                      <div>
                        <label className={labelClass}>Branche</label>
                        <input value={waProfileVertical} onChange={(e) => { setWaProfileVertical(e.target.value); setWaProfileEditing(true); }} className={inputClass} placeholder="Bijv. PROF_SERVICES" />
                      </div>
                      <div className="md:col-span-2">
                        <label className={labelClass}>Beschrijving</label>
                        <textarea value={waProfileDescription} onChange={(e) => { setWaProfileDescription(e.target.value); setWaProfileEditing(true); }} className={`${inputClass} min-h-[60px]`} placeholder="Uitgebreide beschrijving van je bedrijf" />
                      </div>
                      <div>
                        <label className={labelClass}>Adres</label>
                        <input value={waProfileAddress} onChange={(e) => { setWaProfileAddress(e.target.value); setWaProfileEditing(true); }} className={inputClass} placeholder="Straat 1, Stad" />
                      </div>
                      <div>
                        <label className={labelClass}>E-mail</label>
                        <input value={waProfileEmail} onChange={(e) => { setWaProfileEmail(e.target.value); setWaProfileEditing(true); }} className={inputClass} placeholder="info@bedrijf.nl" type="email" />
                      </div>
                      <div>
                        <label className={labelClass}>Website</label>
                        <input value={waProfileWebsite} onChange={(e) => { setWaProfileWebsite(e.target.value); setWaProfileEditing(true); }} className={inputClass} placeholder="https://www.bedrijf.nl" />
                      </div>
                    </div>
                    {waProfileEditing && (
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={async () => {
                            try {
                              await updateWaProfile.mutateAsync({
                                about: waProfileAbout || undefined,
                                description: waProfileDescription || undefined,
                                address: waProfileAddress || undefined,
                                email: waProfileEmail || undefined,
                                vertical: waProfileVertical || undefined,
                                websites: waProfileWebsite ? [waProfileWebsite] : undefined,
                              });
                              toast({ title: "Bedrijfsprofiel bijgewerkt" });
                              setWaProfileEditing(false);
                            } catch (err: any) {
                              toast({ title: "Fout", description: err.message, variant: "destructive" });
                            }
                          }}
                          disabled={updateWaProfile.isPending}
                          className="px-4 py-2 bg-primary text-primary-foreground rounded-sm text-[12px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50"
                        >
                          {updateWaProfile.isPending ? "Opslaan..." : "Profiel opslaan"}
                        </button>
                        <button
                          onClick={() => {
                            if (waProfile) {
                              setWaProfileAbout(waProfile.about || "");
                              setWaProfileDescription(waProfile.description || "");
                              setWaProfileAddress(waProfile.address || "");
                              setWaProfileEmail(waProfile.email || "");
                              setWaProfileWebsite(waProfile.websites?.[0] || "");
                              setWaProfileVertical(waProfile.vertical || "");
                            }
                            setWaProfileEditing(false);
                          }}
                          className="px-4 py-2 bg-card border border-border rounded-sm text-[12px] font-bold text-secondary-foreground hover:bg-bg-hover transition-colors"
                        >
                          Annuleren
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  const tenantId = waStatus?.tenant_id;
                  if (!tenantId) {
                    toast({ title: "Fout", description: "Geen tenant_id gevonden. Koppel opnieuw.", variant: "destructive" });
                    return;
                  }
                  const popup = window.open(
                    `https://connect.sitejob.nl/whatsapp-setup?tenant_id=${tenantId}`,
                    "whatsapp-setup",
                    "width=600,height=700"
                  );
                  const handler = (event: MessageEvent) => {
                    if (event.data === "whatsapp-connected") {
                      queryClient.invalidateQueries({ queryKey: ["whatsapp-config-status"] });
                      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
                      window.removeEventListener("message", handler);
                    }
                  };
                  window.addEventListener("message", handler);
                }}
                className="px-4 py-2 bg-card border border-border rounded-sm text-[12px] font-bold text-secondary-foreground hover:bg-bg-hover transition-colors"
              >
                🔄 Opnieuw koppelen
              </button>
              <button
                onClick={async () => {
                  if (!confirm("Weet je zeker dat je WhatsApp wilt ontkoppelen?")) return;
                  try {
                    const { error } = await supabase.functions.invoke("whatsapp-send", {
                      body: { action: "disconnect" },
                    });
                    if (error) throw error;
                    queryClient.invalidateQueries({ queryKey: ["whatsapp-config-status"] });
                    queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
                    toast({ title: "WhatsApp ontkoppeld" });
                  } catch (err: any) {
                    toast({ title: "Fout", description: err.message, variant: "destructive" });
                  }
                }}
                className="px-4 py-2 bg-destructive/10 border border-destructive/20 rounded-sm text-[12px] font-bold text-destructive hover:bg-destructive/20 transition-colors"
              >
                ❌ Ontkoppelen
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-[12px] font-bold text-muted-foreground">
                <XCircle className="h-4 w-4" />
                Niet verbonden
              </div>
              <button
                onClick={async () => {
                  try {
                    // Stap 1: Registreer tenant via edge function (beveiligt API key server-side)
                    const profileRes = await supabase.from("profiles").select("company_name").eq("id", user!.id).single();
                    const companyNameVal = profileRes.data?.company_name || "Mijn bedrijf";
                    const webhookUrl = `https://hhozgcmkickfdesnlpgs.supabase.co/functions/v1/whatsapp-webhook`;

                    const { data: registerData, error: registerError } = await supabase.functions.invoke("whatsapp-register", {
                      body: { name: companyNameVal, webhook_url: webhookUrl },
                    });
                    if (registerError) throw registerError;
                    if (!registerData?.tenant_id) throw new Error("Geen tenant_id ontvangen");

                    // Stap 2: Open popup
                    const popup = window.open(
                      `https://connect.sitejob.nl/whatsapp-setup?tenant_id=${registerData.tenant_id}`,
                      "whatsapp-setup",
                      "width=600,height=700"
                    );
                    const handler = (event: MessageEvent) => {
                      if (event.data === "whatsapp-connected") {
                        queryClient.invalidateQueries({ queryKey: ["whatsapp-config-status"] });
                        queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
                        window.removeEventListener("message", handler);
                      }
                    };
                    window.addEventListener("message", handler);
                  } catch (err: any) {
                    toast({ title: "Fout bij koppelen", description: err.message, variant: "destructive" });
                  }
                }}
                className="px-5 py-2.5 bg-primary text-primary-foreground rounded-sm text-[13px] font-bold hover:bg-primary-hover transition-colors"
              >
                💬 Koppel WhatsApp
              </button>
            </div>
          )}

          {/* Handleiding */}
          <div className="border-t border-border pt-5">
            <button
              onClick={() => setWaGuideOpen(!waGuideOpen)}
              className="flex items-center gap-2 w-full text-left"
            >
              <BookOpen className="h-4 w-4 text-primary" />
              <span className="text-[14px] font-bold flex-1">Handleiding WhatsApp koppeling</span>
              {waGuideOpen ? <ChevronUp className="h-4 w-4 text-t3" /> : <ChevronDown className="h-4 w-4 text-t3" />}
            </button>
            {waGuideOpen && (
              <div className="mt-4 space-y-5 text-[12.5px] text-secondary-foreground">
                {/* Vereisten */}
                <div>
                  <h4 className="text-[13px] font-bold text-foreground mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                    Vereisten
                  </h4>
                  <ol className="list-decimal list-inside space-y-1 ml-1">
                    <li><strong>Meta Business Account</strong> — Maak er een aan op <a href="https://business.facebook.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">business.facebook.com</a></li>
                    <li><strong>WhatsApp Business Account (WABA)</strong> — Wordt automatisch aangemaakt tijdens de koppeling</li>
                    <li><strong>Actief telefoonnummer</strong> — Mag niet al in gebruik zijn bij een andere WhatsApp-installatie</li>
                  </ol>
                </div>

                {/* Stappen */}
                <div>
                  <h4 className="text-[13px] font-bold text-foreground mb-2">Stap-voor-stap koppeling</h4>
                  <div className="space-y-2 ml-1">
                    <div className="flex gap-2">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center">1</span>
                      <div><strong>Klik op "Koppel WhatsApp"</strong> hierboven. Er opent een popup met de Facebook login.</div>
                    </div>
                    <div className="flex gap-2">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center">2</span>
                      <div><strong>Log in met je Facebook account</strong> dat gekoppeld is aan je Meta Business Account.</div>
                    </div>
                    <div className="flex gap-2">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center">3</span>
                      <div><strong>Selecteer je Business Portfolio</strong> — kies het juiste Meta Business Account.</div>
                    </div>
                    <div className="flex gap-2">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center">4</span>
                      <div><strong>Maak of selecteer een WhatsApp Business Account</strong> — selecteer een bestaande WABA of maak een nieuwe aan.</div>
                    </div>
                    <div className="flex gap-2">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center">5</span>
                      <div><strong>Registreer een telefoonnummer</strong> — voer een nieuw nummer in of selecteer een bestaand nummer.</div>
                    </div>
                    <div className="flex gap-2">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center">6</span>
                      <div><strong>Verifieer via SMS</strong> — voer de verificatiecode in die je per SMS ontvangt.</div>
                    </div>
                  </div>
                </div>

                {/* Na koppeling */}
                <div className="bg-success-muted/50 border border-success/20 rounded-md p-3">
                  <h4 className="text-[12px] font-bold text-success mb-1.5">✅ Na succesvolle koppeling</h4>
                  <ul className="space-y-0.5 text-[11.5px]">
                    <li>• WhatsApp Business Account is gekoppeld</li>
                    <li>• Telefoonnummer is geregistreerd</li>
                    <li>• Webhook is automatisch ingesteld</li>
                    <li>• Je kunt direct berichten versturen en ontvangen</li>
                  </ul>
                </div>

                {/* Status tabel */}
                <div>
                  <h4 className="text-[13px] font-bold text-foreground mb-2">Status</h4>
                  <div className="border border-border rounded-md overflow-hidden">
                    <div className="grid grid-cols-[100px_1fr] text-[11.5px]">
                      <div className="px-3 py-2 bg-muted font-bold border-b border-r border-border">Status</div>
                      <div className="px-3 py-2 bg-muted font-bold border-b border-border">Betekenis</div>
                      <div className="px-3 py-2 border-b border-r border-border"><span className="inline-flex px-2 py-[1px] rounded-full text-[10px] font-bold bg-warning-muted text-warning">pending</span></div>
                      <div className="px-3 py-2 border-b border-border">Tenant is aangemaakt maar nog niet gekoppeld</div>
                      <div className="px-3 py-2 border-b border-r border-border"><span className="inline-flex px-2 py-[1px] rounded-full text-[10px] font-bold bg-success-muted text-success">active</span></div>
                      <div className="px-3 py-2 border-b border-border">WhatsApp is succesvol gekoppeld en actief</div>
                      <div className="px-3 py-2 border-r border-border"><span className="inline-flex px-2 py-[1px] rounded-full text-[10px] font-bold bg-destructive/10 text-destructive">disconnected</span></div>
                      <div className="px-3 py-2">Koppeling is verbroken</div>
                    </div>
                  </div>
                </div>

                {/* Problemen oplossen */}
                <div>
                  <h4 className="text-[13px] font-bold text-foreground mb-2 flex items-center gap-1.5">
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    Problemen oplossen
                  </h4>
                  <div className="space-y-3 ml-1">
                    <div>
                      <p className="font-bold text-foreground mb-0.5">Geen WABA ID gevonden</p>
                      <p>Controleer of je de juiste permissies hebt gegeven tijdens de Facebook login. Beide scopes moeten zijn geaccepteerd: <code className="bg-muted px-1 rounded text-[11px]">whatsapp_business_management</code> en <code className="bg-muted px-1 rounded text-[11px]">whatsapp_business_messaging</code>.</p>
                    </div>
                    <div>
                      <p className="font-bold text-foreground mb-0.5">Berichten komen niet aan</p>
                      <p>Probeer opnieuw te koppelen via de "Opnieuw koppelen" knop hierboven. Dit herstelt de webhook-instellingen en permissies.</p>
                    </div>
                    <div>
                      <p className="font-bold text-foreground mb-0.5">Token verlopen</p>
                      <p>Access tokens zijn 60 dagen geldig. SiteJob Connect vernieuwt tokens automatisch. Bij problemen, koppel opnieuw via de "Opnieuw koppelen" knop.</p>
                    </div>
                  </div>
                </div>

                {/* Berichtlimieten */}
                <div>
                  <h4 className="text-[13px] font-bold text-foreground mb-2">Berichtlimieten</h4>
                  <div className="space-y-1 ml-1 text-[11.5px]">
                    <p>• <strong>Binnen 24-uurs venster:</strong> Alle berichttypen (tekst, media, interactief)</p>
                    <p>• <strong>Buiten 24-uurs venster:</strong> Alleen goedgekeurde templates</p>
                    <p>• <strong>Rate limit:</strong> Max 20 berichten per minuut per gebruiker</p>
                    <p>• <strong>Opt-in:</strong> Stuur alleen berichten naar klanten die toestemming hebben gegeven</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 7 && (
        <div className="bg-card border border-border rounded-lg shadow-card p-5 md:p-6 space-y-5">
          <div>
            <h3 className="text-[14px] font-bold mb-1">WhatsApp Automatiseringen</h3>
            <p className="text-[12px] text-secondary-foreground mb-3">Stel automatische WhatsApp-berichten in op basis van gebeurtenissen.</p>
          </div>

          <button
            onClick={() => { setAutoDialogOpen(true); setAutoName(""); setAutoTrigger(""); setAutoTemplate(""); setAutoLanguage("nl"); setAutoCooldown("720"); setAutoMapping({}); }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-sm text-[13px] font-bold hover:bg-primary-hover transition-colors flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Nieuwe automatisering
          </button>

          {automationsLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : !automations?.length ? (
            <p className="text-[13px] text-muted-foreground text-center py-6">Nog geen automatiseringen ingesteld.</p>
          ) : (
            <div className="space-y-2">
              {automations.map((a) => (
                <div key={a.id} className="flex items-center gap-3 p-3 border border-border rounded-md bg-background">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold truncate">{a.name}</p>
                    <p className="text-[11px] text-secondary-foreground">
                      {TRIGGER_TYPES.find(t => t.value === a.trigger_type)?.label ?? a.trigger_type} → {a.template_name}
                    </p>
                  </div>
                  <button
                    onClick={async () => { await updateAutomation.mutateAsync({ id: a.id, is_active: !a.is_active }); }}
                    className={`px-2.5 py-1 rounded-sm text-[11px] font-bold transition-colors ${a.is_active ? "bg-success-muted text-success" : "bg-muted text-t3"}`}
                  >
                    {a.is_active ? "Actief" : "Uit"}
                  </button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeletingAutoId(a.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Create automation dialog */}
          {autoDialogOpen && (
            <div className="border border-primary/30 rounded-md p-4 bg-primary/5 space-y-3">
              <h4 className="text-[13px] font-bold">Nieuwe automatisering</h4>
              <div>
                <label className={labelClass}>Naam</label>
                <input value={autoName} onChange={(e) => setAutoName(e.target.value)} className={inputClass} placeholder="Bijv. Afspraakbevestiging" />
              </div>
              <div>
                <label className={labelClass}>Trigger</label>
                <Select value={autoTrigger} onValueChange={(v) => { setAutoTrigger(v); setAutoMapping({}); }}>
                  <SelectTrigger><SelectValue placeholder="Kies gebeurtenis" /></SelectTrigger>
                  <SelectContent>
                    {TRIGGER_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className={labelClass}>WhatsApp Template</label>
                <Select value={autoTemplate} onValueChange={(v) => {
                  setAutoTemplate(v);
                  // Auto-detect parameter format and pre-fill mapping keys
                  const selectedTpl = waTemplates?.find((t: any) => t.name === v);
                  if (selectedTpl && autoTrigger && AVAILABLE_VARIABLES[autoTrigger]) {
                    const isPositional = !selectedTpl.parameter_format || selectedTpl.parameter_format === "POSITIONAL";
                    // Extract params from template body component
                    const bodyComp = selectedTpl.components?.find((c: any) => c.type === "BODY");
                    const bodyText: string = bodyComp?.text || "";
                    const paramMatches = isPositional
                      ? [...bodyText.matchAll(/\{\{(\d+)\}\}/g)].map(m => m[1])
                      : [...bodyText.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]);
                    const uniqueParams = [...new Set(paramMatches)];
                    // Auto-map: match params to available variables in order
                    const vars = AVAILABLE_VARIABLES[autoTrigger];
                    const newMapping: Record<string, string> = {};
                    uniqueParams.forEach((param, i) => {
                      if (i < vars.length) {
                        newMapping[param] = vars[i].path;
                      }
                    });
                    setAutoMapping(newMapping);
                  } else {
                    setAutoMapping({});
                  }
                }}>
                  <SelectTrigger><SelectValue placeholder="Kies template" /></SelectTrigger>
                  <SelectContent>
                    {waTemplates?.filter((t: any) => t.status === "APPROVED").map((t: any) => (
                      <SelectItem key={t.name} value={t.name}>{t.name} ({t.language})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {autoTemplate && (() => {
                  const tpl = waTemplates?.find((t: any) => t.name === autoTemplate);
                  if (!tpl) return null;
                  const format = tpl.parameter_format || "POSITIONAL";
                  return (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Parameter formaat: <span className="font-bold">{format}</span>
                      {format === "POSITIONAL" ? " — parameters als {{1}}, {{2}}, ..." : " — parameters als {{naam}}, {{datum}}, ..."}
                    </p>
                  );
                })()}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Taal</label>
                  <input value={autoLanguage} onChange={(e) => setAutoLanguage(e.target.value)} className={inputClass} placeholder="nl" />
                </div>
                <div>
                  <label className={labelClass}>Cooldown (uren)</label>
                  <input type="number" value={autoCooldown} onChange={(e) => setAutoCooldown(e.target.value)} className={inputClass} placeholder="720" />
                </div>
              </div>
              {autoTrigger && AVAILABLE_VARIABLES[autoTrigger] && (
                <div>
                  <label className={labelClass}>Variabelen koppelen (template param → veld)</label>
                  <p className="text-[11px] text-muted-foreground mb-1.5">
                    {(() => {
                      const tpl = waTemplates?.find((t: any) => t.name === autoTemplate);
                      const isPositional = !tpl?.parameter_format || tpl?.parameter_format === "POSITIONAL";
                      return isPositional
                        ? "Voer het parameternummer in (1, 2, 3...) dat overeenkomt met de template variabele."
                        : "Voer de parameternaam in (bijv. first_name, date) die overeenkomt met de template variabele.";
                    })()}
                  </p>
                  <div className="space-y-1.5">
                    {AVAILABLE_VARIABLES[autoTrigger].map((v) => (
                      <div key={v.path} className="flex items-center gap-2 text-[12px]">
                        <input
                          className={`${inputClass} flex-1`}
                          placeholder={(() => {
                            const tpl = waTemplates?.find((t: any) => t.name === autoTemplate);
                            const isPositional = !tpl?.parameter_format || tpl?.parameter_format === "POSITIONAL";
                            return isPositional ? "Nummer (bijv. 1)" : "Naam (bijv. first_name)";
                          })()}
                          value={Object.entries(autoMapping).find(([, val]) => val === v.path)?.[0] ?? ""}
                          onChange={(e) => {
                            const newMapping = { ...autoMapping };
                            for (const [k, val] of Object.entries(newMapping)) { if (val === v.path) delete newMapping[k]; }
                            if (e.target.value) newMapping[e.target.value] = v.path;
                            setAutoMapping(newMapping);
                          }}
                        />
                        <span className="text-t3 whitespace-nowrap">→ {v.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={async () => {
                    try {
                      await createAutomation.mutateAsync({
                        name: autoName,
                        trigger_type: autoTrigger,
                        template_name: autoTemplate,
                        template_language: autoLanguage,
                        variable_mapping: autoMapping,
                        conditions: {},
                        is_active: true,
                        cooldown_hours: parseInt(autoCooldown) || 720,
                      });
                      toast({ title: "Automatisering aangemaakt" });
                      setAutoDialogOpen(false);
                    } catch (err: any) {
                      toast({ title: "Fout", description: err.message, variant: "destructive" });
                    }
                  }}
                  disabled={!autoName || !autoTrigger || !autoTemplate || createAutomation.isPending}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-sm text-[13px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50"
                >
                  {createAutomation.isPending ? "Opslaan..." : "Opslaan"}
                </button>
                <button onClick={() => setAutoDialogOpen(false)} className="px-4 py-2 bg-card border border-border rounded-sm text-[13px] font-bold text-secondary-foreground hover:bg-bg-hover transition-colors">
                  Annuleren
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <AlertDialog open={!!deletingAutoId} onOpenChange={(open) => !open && setDeletingAutoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Automatisering verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>Deze automatisering wordt permanent verwijderd.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { await deleteAutomation.mutateAsync(deletingAutoId!); setDeletingAutoId(null); toast({ title: "Automatisering verwijderd" }); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {activeTab === 8 && (
        <div className="bg-card border border-border rounded-lg shadow-card p-5 md:p-6 space-y-5">
          <div>
            <h3 className="text-[14px] font-bold mb-1">Teamlid uitnodigen</h3>
            <p className="text-[12px] text-secondary-foreground mb-3">Nodig een nieuw teamlid uit via e-mail. Ze ontvangen een link om een wachtwoord in te stellen.</p>
          </div>
          <div className="space-y-3">
            <div>
              <label className={labelClass}>E-mailadres</label>
              <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className={inputClass} placeholder="collega@bedrijf.nl" type="email" />
            </div>
            <div>
              <label className={labelClass}>Naam (optioneel)</label>
              <input value={inviteName} onChange={(e) => setInviteName(e.target.value)} className={inputClass} placeholder="Volledige naam" />
            </div>
            <div>
              <label className={labelClass}>Rol</label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monteur">Monteur</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-t3 mt-1">Monteurs zien alleen planning en werkbonnen</p>
            </div>
            <button
              onClick={handleInviteUser}
              disabled={inviting || !inviteEmail}
              className="px-5 py-2.5 bg-primary text-primary-foreground rounded-sm text-[13px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {inviting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
              Uitnodigen
            </button>
          </div>

          <div className="border-t border-border pt-5">
            <h3 className="text-[14px] font-bold mb-3 flex items-center gap-1.5">
              <Users className="h-4 w-4" /> Teamleden
            </h3>
            {teamLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : !teamMembers.length ? (
              <p className="text-[13px] text-muted-foreground text-center py-6">Nog geen teamleden.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Naam</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Aangemaakt</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamMembers.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.full_name || "—"}</TableCell>
                      <TableCell>
                        {m.id === user?.id ? (
                          <span className="text-[12px] font-semibold text-primary">Admin</span>
                        ) : (
                          <Select value={teamRoles[m.id] || "monteur"} onValueChange={(val) => handleChangeRole(m.id, val)}>
                            <SelectTrigger className="h-8 w-[120px] text-[12px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="monteur">Monteur</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(m.created_at).toLocaleDateString("nl-NL")}
                      </TableCell>
                      <TableCell>
                        {m.id !== user?.id && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeletingMemberId(m.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      )}
      <ServiceDialog
        open={serviceDialogOpen}
        onOpenChange={setServiceDialogOpen}
        service={editingService}
      />

      <AlertDialog open={!!deletingServiceId} onOpenChange={(open) => !open && setDeletingServiceId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dienst verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze dienst wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteService} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TemplateDialog
        open={templateDialogOpen}
        onOpenChange={setTemplateDialogOpen}
        editTemplate={editingTemplate}
        prefill={editingStandardTemplate}
      />

      <AlertDialog open={!!deletingTemplateId} onOpenChange={(open) => !open && setDeletingTemplateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sjabloon verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je dit sjabloon wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { await deleteTemplate.mutateAsync(deletingTemplateId!); setDeletingTemplateId(null); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!hidingStandardId} onOpenChange={(open) => !open && setHidingStandardId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Standaard sjabloon verbergen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dit sjabloon wordt verborgen uit de lijst. Je kunt het later herstellen via de knop onderaan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={() => { hideStandardTemplate(hidingStandardId!); setHidingStandardId(null); }}>
              Verbergen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingMemberId} onOpenChange={(open) => !open && setDeletingMemberId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Teamlid verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dit verwijdert het account van dit teamlid permanent. Ze kunnen daarna niet meer inloggen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingMember}>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMember} disabled={deletingMember} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deletingMember ? "Verwijderen..." : "Verwijderen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SettingsPage;
