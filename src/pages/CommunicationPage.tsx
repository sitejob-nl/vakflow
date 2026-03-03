import { useState, useMemo } from "react";
import { useSignedUrl } from "@/hooks/useSignedUrl";
import { useCommunicationLogs, useCreateCommunicationLog, useDeleteCommunicationLog, useSendEmail } from "@/hooks/useCommunicationLogs";
import { useWhatsAppMessages } from "@/hooks/useWhatsAppMessages";
import { useCustomers } from "@/hooks/useCustomers";
import { useAuth } from "@/contexts/AuthContext";
import { useWhatsAppStatus } from "@/hooks/useWhatsAppStatus";
import { Loader2, Trash2, Plus, Mail, MessageSquare, Phone, StickyNote, ChevronDown, ChevronUp, Search, RefreshCw, FileText, Play, Mic, CheckCheck, Smile, Settings2 } from "lucide-react";
import ComposeWhatsAppDialog from "@/components/ComposeWhatsAppDialog";
import { useWhatsApp } from "@/hooks/useWhatsApp";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useAutoMessageSettings, useUpsertAutoMessageSetting, LABELS, type MessageType, type AutoMessageSetting } from "@/hooks/useAutoMessageSettings";
import { useWhatsAppTemplates } from "@/hooks/useWhatsAppTemplates";

type ChannelTab = "Alle" | "email" | "whatsapp" | "telefoon" | "notitie";
const channelTabs: ChannelTab[] = ["Alle", "email", "whatsapp", "telefoon", "notitie"];

const channelLabels: Record<string, string> = {
  Alle: "Alle", email: "E-mail", whatsapp: "WhatsApp", telefoon: "Telefoon", notitie: "Notitie",
};
const channelIcon: Record<string, string> = {
  email: "📧", whatsapp: "💬", telefoon: "📞", notitie: "📝", review: "⭐",
};
const dotColors: Record<string, string> = {
  email: "border-primary bg-primary-muted",
  whatsapp: "border-accent bg-accent-muted",
  telefoon: "border-warning bg-warning-muted",
  notitie: "border-muted-foreground bg-muted",
  review: "border-purple bg-purple-muted",
};
const tagStyles: Record<string, string> = {
  email: "bg-primary-muted text-primary",
  whatsapp: "bg-accent-muted text-accent",
  telefoon: "bg-warning-muted text-warning",
  notitie: "bg-muted text-muted-foreground",
  review: "bg-purple-muted text-purple",
};

const statusBadge: Record<string, { label: string; cls: string }> = {
  sent: { label: "Verzonden", cls: "bg-success-muted text-success" },
  failed: { label: "Mislukt", cls: "bg-destructive/10 text-destructive" },
};

type DialogType = "email" | "telefoon" | "notitie" | "generic" | null;

const CommunicationPage = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<ChannelTab>("Alle");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [waDialogOpen, setWaDialogOpen] = useState(false);
  const [waCustomerId, setWaCustomerId] = useState("");
  const [openDialog, setOpenDialog] = useState<DialogType>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { companyId } = useAuth();
  const { data: logs, isLoading } = useCommunicationLogs(undefined, companyId);
  const { data: waMessages, isLoading: waLoading } = useWhatsAppMessages();
  const { data: customers } = useCustomers();
  const { data: waStatus } = useWhatsAppStatus();
  const createLog = useCreateCommunicationLog();
  const deleteLog = useDeleteCommunicationLog();
  const sendEmail = useSendEmail();
  const sendWhatsApp = useWhatsApp();
  const [sending, setSending] = useState(false);
  const [reactingId, setReactingId] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  // Auto-message settings
  const { data: autoSettings } = useAutoMessageSettings();
  const upsertSetting = useUpsertAutoMessageSetting();
  const [editingType, setEditingType] = useState<MessageType | null>(null);
  const [sheetEnabled, setSheetEnabled] = useState(true);
  const [sheetChannel, setSheetChannel] = useState<"whatsapp" | "email" | "both">("whatsapp");
  const [sheetTemplate, setSheetTemplate] = useState("");
  const [sheetCustomText, setSheetCustomText] = useState("");
  const [sheetDelay, setSheetDelay] = useState("0");
  const { data: waTemplates } = useWhatsAppTemplates(!!editingType);

  const openAutoSheet = (setting: AutoMessageSetting) => {
    setEditingType(setting.message_type);
    setSheetEnabled(setting.enabled);
    setSheetChannel(setting.channel);
    setSheetTemplate(setting.template_name || "");
    setSheetCustomText(setting.custom_text || "");
    setSheetDelay(String(setting.delay_hours));
  };

  const handleSaveAutoSetting = async () => {
    if (!editingType) return;
    try {
      await upsertSetting.mutateAsync({
        message_type: editingType,
        enabled: sheetEnabled,
        channel: sheetChannel,
        template_name: sheetTemplate || null,
        custom_text: sheetCustomText || null,
        delay_hours: parseInt(sheetDelay) || 0,
      });
      toast({ title: "Opgeslagen", description: `${LABELS[editingType]} instellingen bijgewerkt.` });
      setEditingType(null);
    } catch {
      toast({ title: "Fout", description: "Kon instelling niet opslaan.", variant: "destructive" });
    }
  };
  const queryClient = useQueryClient();

  const handleFetchEmails = async () => {
    setFetching(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Niet ingelogd");

      const res = await fetch(
        `https://sigzpqwnavfxtvbyqvzj.supabase.co/functions/v1/fetch-emails`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Ophalen mislukt");

      queryClient.invalidateQueries({ queryKey: ["communication_logs"] });
      toast({
        title: json.fetched > 0
          ? `${json.fetched} nieuwe e-mail(s) opgehaald`
          : "Geen nieuwe e-mails",
      });
    } catch (err: any) {
      toast({ title: "Fout bij ophalen", description: err.message, variant: "destructive" });
    }
    setFetching(false);
  };

  // Form state
  const [formCustomerId, setFormCustomerId] = useState("");
  const [formSubject, setFormSubject] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formDirection, setFormDirection] = useState("outbound");
  // Generic dialog extras
  const [formChannel, setFormChannel] = useState("notitie");

  // Merge incoming WhatsApp messages into timeline
  type UnifiedItem = {
    id: string;
    channel: string;
    direction: string;
    subject: string | null;
    body: string | null;
    status: string;
    sent_at: string | null;
    created_at: string;
    is_automated: boolean;
    customer_id: string | null;
    customers?: { name: string } | null;
    // WhatsApp media fields
    wa_type?: string | null;
    wa_metadata?: any;
    source: "log" | "wa";
  };

  const allItems = useMemo<UnifiedItem[]>(() => {
    const logItems: UnifiedItem[] = (logs ?? []).map((l) => ({
      id: l.id,
      channel: l.channel,
      direction: l.direction,
      subject: l.subject,
      body: l.body,
      status: l.status,
      sent_at: l.sent_at,
      created_at: l.created_at,
      is_automated: l.is_automated,
      customer_id: l.customer_id,
      customers: l.customers,
      source: "log" as const,
    }));

    // Only add incoming WA messages not already in communication_logs
    const existingWamids = new Set(
      (logs ?? [])
        .filter((l) => l.channel === "whatsapp" && l.message_id)
        .map((l) => l.message_id)
    );

    const waItems: UnifiedItem[] = (waMessages ?? [])
      .filter((m) => !m.wamid || !existingWamids.has(m.wamid))
      .map((m) => {
        const customerName = customers?.find((c) => c.id === m.customer_id)?.name;
        return {
          id: m.id,
          channel: "whatsapp",
          direction: m.direction,
          subject: null,
          body: m.content,
          status: m.status || "received",
          sent_at: m.created_at,
          created_at: m.created_at || new Date().toISOString(),
          is_automated: false,
          customer_id: m.customer_id,
          customers: customerName ? { name: customerName } : null,
          wa_type: m.type,
          wa_metadata: { ...m.metadata, wamid: m.wamid, from_number: m.from_number },
          source: "wa" as const,
        };
      });

    return [...logItems, ...waItems].sort((a, b) => {
      const da = a.sent_at ?? a.created_at;
      const db = b.sent_at ?? b.created_at;
      return new Date(db).getTime() - new Date(da).getTime();
    });
  }, [logs, waMessages, customers]);

  const filtered = useMemo(() => {
    let result = allItems;
    if (activeTab !== "Alle") result = result.filter((l) => l.channel === activeTab);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((l) =>
        l.customers?.name?.toLowerCase().includes(q) ||
        l.subject?.toLowerCase().includes(q) ||
        l.body?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [allItems, activeTab, searchQuery]);

  const resetForm = () => {
    setFormCustomerId("");
    setFormSubject("");
    setFormBody("");
    setFormDirection("outbound");
    setFormChannel("notitie");
  };

  const selectedCustomer = customers?.find((c) => c.id === formCustomerId);

  // Customers with email for email dialog
  const emailCustomers = useMemo(
    () => customers?.filter((c) => c.email) ?? [],
    [customers]
  );

  // ---- Actions per tab ----
  const handleNewClick = () => {
    resetForm();
    switch (activeTab) {
      case "email":
        setOpenDialog("email");
        break;
      case "whatsapp":
        setWaCustomerId("");
        setWaDialogOpen(true);
        break;
      case "telefoon":
        setOpenDialog("telefoon");
        break;
      case "notitie":
        setOpenDialog("notitie");
        break;
      default:
        setOpenDialog("generic");
    }
  };

  const newButtonLabel: Record<ChannelTab, string> = {
    Alle: "Nieuw",
    email: "Nieuwe e-mail",
    whatsapp: "Nieuw WhatsApp",
    telefoon: "Nieuw gesprek",
    notitie: "Nieuwe notitie",
  };
  const newButtonIcon: Record<ChannelTab, React.ReactNode> = {
    Alle: <Plus className="h-3.5 w-3.5 mr-1" />,
    email: <Mail className="h-3.5 w-3.5 mr-1" />,
    whatsapp: <MessageSquare className="h-3.5 w-3.5 mr-1" />,
    telefoon: <Phone className="h-3.5 w-3.5 mr-1" />,
    notitie: <StickyNote className="h-3.5 w-3.5 mr-1" />,
  };

  // ---- Submit handlers ----
  const handleEmailSubmit = async () => {
    if (!formCustomerId) { toast({ title: "Selecteer een klant", variant: "destructive" }); return; }
    if (!selectedCustomer?.email) { toast({ title: "Deze klant heeft geen e-mailadres", variant: "destructive" }); return; }
    if (!formSubject || !formBody) { toast({ title: "Vul onderwerp en bericht in", variant: "destructive" }); return; }

    setSending(true);
    let status = "sent";
    try {
      await sendEmail.mutateAsync({ to: selectedCustomer.email, subject: formSubject, body: formBody });
    } catch (err: any) {
      status = "failed";
      toast({ title: "E-mail verzending mislukt", description: err.message, variant: "destructive" });
    }
    setSending(false);

    try {
      await createLog.mutateAsync({
        customer_id: formCustomerId, channel: "email", subject: formSubject, body: formBody,
        direction: "outbound", is_automated: false, status, sent_at: new Date().toISOString(),
      });
      if (status === "sent") toast({ title: "E-mail verzonden" });
      setOpenDialog(null); resetForm();
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  const handleSimpleSubmit = async (channel: "telefoon" | "notitie") => {
    if (!formCustomerId) { toast({ title: "Selecteer een klant", variant: "destructive" }); return; }
    const direction = channel === "telefoon" ? formDirection : "outbound";
    try {
      await createLog.mutateAsync({
        customer_id: formCustomerId, channel, subject: null, body: formBody || null,
        direction, is_automated: false, status: "sent", sent_at: new Date().toISOString(),
      });
      toast({ title: "Opgeslagen" });
      setOpenDialog(null); resetForm();
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  const handleGenericSubmit = async () => {
    if (!formCustomerId) { toast({ title: "Selecteer een klant", variant: "destructive" }); return; }
    const isEmailOut = formChannel === "email" && formDirection === "outbound";

    let status = "sent";
    if (isEmailOut) {
      if (!selectedCustomer?.email) { toast({ title: "Deze klant heeft geen e-mailadres", variant: "destructive" }); return; }
      if (!formSubject || !formBody) { toast({ title: "Vul onderwerp en bericht in", variant: "destructive" }); return; }
      setSending(true);
      try { await sendEmail.mutateAsync({ to: selectedCustomer.email, subject: formSubject, body: formBody }); }
      catch (err: any) { status = "failed"; toast({ title: "E-mail verzending mislukt", description: err.message, variant: "destructive" }); }
      setSending(false);
    }

    try {
      await createLog.mutateAsync({
        customer_id: formCustomerId, channel: formChannel, subject: formSubject || null,
        body: formBody || null, direction: formDirection, is_automated: false, status, sent_at: new Date().toISOString(),
      });
      if (status === "sent") toast({ title: isEmailOut ? "E-mail verzonden" : "Bericht opgeslagen" });
      setOpenDialog(null); resetForm();
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await deleteLog.mutateAsync(deleteTarget); toast({ title: "Bericht verwijderd" }); }
    catch (err: any) { toast({ title: "Fout", description: err.message, variant: "destructive" }); }
    setDeleteTarget(null);
  };

  const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "🙏", "👏"];

  const handleMarkRead = async (wamid: string) => {
    try {
      await supabase.functions.invoke("whatsapp-send", {
        body: { action: "mark_read", message_id: wamid },
      });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-messages"] });
      toast({ title: "Bericht als gelezen gemarkeerd" });
    } catch (err: any) {
      toast({ title: "Markeren mislukt", description: err.message, variant: "destructive" });
    }
  };

  const handleReaction = async (wamid: string, to: string, emoji: string) => {
    setReactingId(null);
    try {
      await sendWhatsApp.mutateAsync({
        to,
        type: "reaction" as any,
        reaction_message_id: wamid,
        emoji,
      } as any);
      toast({ title: `Reactie ${emoji} verstuurd` });
    } catch (err: any) {
      toast({ title: "Reactie mislukt", description: err.message, variant: "destructive" });
    }
  };
  const renderEmailInbox = () => (
    <div className="divide-y divide-border">
      {filtered.length === 0 ? (
        <p className="text-t3 text-sm py-6 text-center">Geen e-mails gevonden.</p>
      ) : filtered.map((m) => {
        const dt = m.sent_at ?? m.created_at;
        const badge = statusBadge[m.status] ?? statusBadge.sent;
        const isExpanded = expandedId === m.id;
        return (
          <div key={m.id} className="group">
            <button
              onClick={() => setExpandedId(isExpanded ? null : m.id)}
              className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/40 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] md:text-[13px] font-bold truncate">
                    {m.subject || "(geen onderwerp)"}
                  </span>
                  <span className={`shrink-0 text-[9px] md:text-[10px] font-bold px-2 py-[1px] rounded-full ${badge.cls}`}>
                    {badge.label}
                  </span>
                  {m.direction === "inbound" && (
                    <span className="shrink-0 text-[9px] md:text-[10px] font-bold px-2 py-[1px] rounded-full bg-muted text-muted-foreground">
                      Inkomend
                    </span>
                  )}
                </div>
                <div className="text-[10px] md:text-[11px] text-t3 mt-0.5 flex items-center gap-1.5">
                  {m.customers?.name && <span className="text-secondary-foreground">{m.customers.name}</span>}
                  <span>·</span>
                  <span className="font-mono">{format(new Date(dt), "dd MMM yyyy HH:mm", { locale: nl })}</span>
                </div>
                {!isExpanded && m.body && (
                  <p className="text-[11px] text-t3 mt-0.5 truncate">{m.body}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                {!m.is_automated && (
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(m.id); }}
                    className="md:opacity-0 md:group-hover:opacity-100 text-t3 hover:text-destructive transition-all p-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </span>
                )}
                {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-t3" /> : <ChevronDown className="h-3.5 w-3.5 text-t3" />}
              </div>
            </button>
            {isExpanded && m.body && (
              <div className="px-4 pb-3 pl-7 text-[12px] md:text-[13px] text-secondary-foreground whitespace-pre-wrap">
                {m.body}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // ---- Inline media renderer ----
  const MediaItem = ({ url, type, alt, filename }: { url: string; type: string; alt?: string; filename?: string }) => {
    const signedUrl = useSignedUrl("whatsapp-media", url);
    if (!signedUrl) return null;

    switch (type) {
      case "image":
        return (
          <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="block mt-1.5">
            <img src={signedUrl} alt={alt || "Afbeelding"} className="rounded-md max-w-[240px] max-h-[180px] object-cover border border-border" loading="lazy" />
          </a>
        );
      case "video":
        return <video src={signedUrl} controls preload="metadata" className="rounded-md max-w-[280px] max-h-[200px] mt-1.5 border border-border" />;
      case "audio":
        return (
          <div className="mt-1.5 flex items-center gap-2">
            <Mic className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <audio src={signedUrl} controls preload="metadata" className="h-8 max-w-[240px]" />
          </div>
        );
      case "document":
        return (
          <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-muted/50 text-[11px] md:text-[12px] text-secondary-foreground hover:bg-muted transition-colors">
            <FileText className="h-3.5 w-3.5 shrink-0" />
            {filename || "Document openen"}
          </a>
        );
      case "sticker":
        return (
          <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="block mt-1.5">
            <img src={signedUrl} alt="Sticker" className="max-w-[120px] max-h-[120px]" loading="lazy" />
          </a>
        );
      default:
        return null;
    }
  };

  const renderMedia = (m: UnifiedItem) => {
    const storageUrl = m.wa_metadata?.storage_url;
    if (!storageUrl || !m.wa_type) return null;
    return <MediaItem url={storageUrl} type={m.wa_type} alt={m.body || undefined} filename={m.wa_metadata?.document?.filename} />;
  };

  // ---- Timeline row (for non-email tabs) ----
  const renderTimeline = () => (
    <div className="px-4 py-3">
      {filtered.length === 0 ? (
        <p className="text-t3 text-sm py-6 text-center">Geen berichten gevonden.</p>
      ) : (
        <div className="relative pl-[26px]">
          <div className="absolute left-[8px] top-[8px] bottom-[8px] w-[2px] bg-border" />
          {filtered.map((m) => {
            const dt = m.sent_at ?? m.created_at;
            const icon = channelIcon[m.channel] ?? "📄";
            const autoLabel = m.is_automated ? "Auto" : "Handmatig";
            const dirLabel = m.direction === "inbound" ? "Inkomend" : (m.direction === "incoming" ? "Inkomend" : "");
            const tagLabel = `${icon} ${channelLabels[m.channel] ?? m.channel} · ${dirLabel || autoLabel}`;
            return (
              <div key={m.id} className="relative py-[11px] group">
                <div className={`absolute -left-[22px] top-[16px] w-3 h-3 rounded-full border-2 ${dotColors[m.channel] ?? "border-muted-foreground bg-muted"}`} />
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] md:text-[11px] text-t3 font-mono">
                      {format(new Date(dt), "dd-MM-yyyy HH:mm", { locale: nl })}
                      {m.customers?.name && (
                        <span className="ml-1.5 md:ml-2 text-secondary-foreground font-sans">— {m.customers.name}</span>
                      )}
                    </div>
                    {m.subject && <div className="text-[12px] md:text-[13px] font-bold mt-1 mb-0.5">{m.subject}</div>}
                    {m.body && <div className="text-[11.5px] md:text-[12.5px] text-secondary-foreground">{m.body}</div>}
                    {renderMedia(m)}
                    <span className={`inline-block text-[9px] md:text-[10px] font-bold px-2 py-[2px] rounded-[10px] mt-1 ${tagStyles[m.channel] ?? "bg-muted text-muted-foreground"}`}>
                      {tagLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {/* WhatsApp actions: mark read + reaction (consolidated) */}
                    {m.channel === "whatsapp" && m.source === "wa" && (() => {
                      const wamid = m.wa_metadata?.wamid || waMessages?.find(w => w.id === m.id)?.wamid;
                      const fromNumber = m.wa_metadata?.from_number || waMessages?.find(w => w.id === m.id)?.from_number || "";
                      if (!wamid) return null;
                      return (
                        <>
                          {(m.direction === "inbound" || m.direction === "incoming") && m.status !== "read" && (
                            <button
                              onClick={() => handleMarkRead(wamid)}
                              title="Als gelezen markeren"
                              className="md:opacity-0 md:group-hover:opacity-100 text-t3 hover:text-primary transition-all p-1"
                            >
                              <CheckCheck className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {m.status === "read" && (
                            <span title="Gelezen" className="text-primary p-1">
                              <CheckCheck className="h-3.5 w-3.5" />
                            </span>
                          )}
                          <Popover open={reactingId === m.id} onOpenChange={(open) => setReactingId(open ? m.id : null)}>
                            <PopoverTrigger asChild>
                              <button
                                title="Reageer met emoji"
                                className="md:opacity-0 md:group-hover:opacity-100 text-t3 hover:text-accent transition-all p-1"
                              >
                                <Smile className="h-3.5 w-3.5" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-2" side="left" align="start">
                              <div className="flex gap-1">
                                {QUICK_EMOJIS.map((emoji) => (
                                  <button
                                    key={emoji}
                                    onClick={() => handleReaction(wamid, fromNumber, emoji)}
                                    className="text-lg hover:scale-125 transition-transform p-1 rounded hover:bg-muted"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </>
                      );
                    })()}
                    {!m.is_automated && m.source === "log" && (
                      <button onClick={() => setDeleteTarget(m.id)} className="md:opacity-0 md:group-hover:opacity-100 text-t3 hover:text-destructive transition-all p-1">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-0 border-b-2 border-border mb-4 md:mb-5 overflow-x-auto scrollbar-hide">
        {channelTabs.map((t) => (
          <button
            key={t}
            onClick={() => { setActiveTab(t); setExpandedId(null); setSearchQuery(""); }}
            className={`px-3.5 md:px-5 py-2.5 text-[12px] md:text-[13px] font-bold border-b-2 -mb-[2px] transition-colors whitespace-nowrap ${
              t === activeTab ? "text-primary border-primary" : "text-t3 border-transparent hover:text-secondary-foreground"
            }`}
          >
            {channelLabels[t]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 md:gap-5">
        {/* Main content */}
        <div className="bg-card border border-border rounded-lg shadow-card overflow-hidden">
          <div className="px-4 py-3 md:py-3.5 border-b border-border flex items-center gap-2">
            <h3 className="text-[13px] md:text-sm font-bold shrink-0">
              {activeTab === "email" ? "Inbox" : "Communicatie-log"}
            </h3>
            {/* Mobile auto-berichten button */}
            <button
              onClick={() => {
                const first = (autoSettings || [])[0];
                if (first) openAutoSheet(first);
              }}
              className="lg:hidden flex items-center gap-1 px-2.5 py-1 bg-card border border-border rounded-sm text-[11px] font-bold text-secondary-foreground hover:bg-bg-hover transition-colors shrink-0"
            >
              <Settings2 className="h-3 w-3" /> Auto
            </button>
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Zoek op klant of onderwerp..."
                className="h-8 pl-8 text-[12px] md:text-[13px]"
              />
            </div>
            {activeTab === "email" && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleFetchEmails}
                disabled={fetching}
                className="text-[11px] md:text-[13px] shrink-0"
              >
                {fetching ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
                Ophalen
              </Button>
            )}
            <Button size="sm" onClick={handleNewClick} className="text-[11px] md:text-[13px] shrink-0">
              {newButtonIcon[activeTab]}
              {newButtonLabel[activeTab]}
            </Button>
          </div>

          {(isLoading || waLoading) ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-t3" />
            </div>
          ) : activeTab === "email" ? renderEmailInbox() : renderTimeline()}
        </div>

        {/* Sidebar - hidden on mobile */}
        <div className="hidden lg:block">
          <div className="bg-card border border-border rounded-lg shadow-card overflow-hidden mb-4">
            <div className="px-4 py-3 md:py-3.5 border-b border-border">
              <h3 className="text-[13px] md:text-sm font-bold">Auto-berichten</h3>
            </div>
            <div className="px-4 py-3 text-[12px] md:text-[13px]">
              {(autoSettings || []).map((s) => (
                <button
                  key={s.message_type}
                  onClick={() => openAutoSheet(s)}
                  className="w-full flex justify-between items-center py-[7px] border-b border-border last:border-b-0 hover:bg-secondary/50 transition-colors rounded-sm px-1 -mx-1 cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Settings2 className="w-3 h-3 text-muted-foreground" />
                    {LABELS[s.message_type]}
                  </span>
                  <span className={`inline-flex px-2 py-[2px] rounded-full text-[10px] font-bold ${s.enabled ? "bg-success-muted text-success" : "bg-muted text-muted-foreground"}`}>
                    {s.enabled ? "Actief" : "Uit"}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg shadow-card overflow-hidden">
            <div className="px-4 py-3 md:py-3.5 border-b border-border">
              <h3 className="text-[13px] md:text-sm font-bold">Statistieken</h3>
            </div>
            <div className="px-4 py-3 text-[12px] md:text-[13px]">
              <div className="flex justify-between py-[7px] border-b border-border"><span>Totaal berichten</span><strong>{allItems.length}</strong></div>
              <div className="flex justify-between py-[7px] border-b border-border"><span>E-mails</span><strong>{allItems.filter((l) => l.channel === "email").length}</strong></div>
              <div className="flex justify-between py-[7px] border-b border-border"><span>WhatsApp</span><strong>{allItems.filter((l) => l.channel === "whatsapp").length}</strong></div>
              <div className="flex justify-between py-[7px]"><span>Notities</span><strong>{allItems.filter((l) => l.channel === "notitie").length}</strong></div>
            </div>
          </div>
        </div>
      </div>

      {/* ---- Email compose dialog ---- */}
      <Dialog open={openDialog === "email"} onOpenChange={(v) => { if (!v) { setOpenDialog(null); resetForm(); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nieuwe e-mail</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Klant</Label>
              <Select value={formCustomerId} onValueChange={setFormCustomerId}>
                <SelectTrigger><SelectValue placeholder="Selecteer klant" /></SelectTrigger>
                <SelectContent>
                  {emailCustomers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCustomer?.email && (
                <p className="text-[11px] text-t3">Aan: {selectedCustomer.email}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Onderwerp</Label>
              <Input value={formSubject} onChange={(e) => setFormSubject(e.target.value)} placeholder="Onderwerp" />
            </div>
            <div className="space-y-2">
              <Label>Bericht</Label>
              <Textarea value={formBody} onChange={(e) => setFormBody(e.target.value)} placeholder="Typ je bericht..." rows={6} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpenDialog(null); resetForm(); }}>Annuleren</Button>
            <Button onClick={handleEmailSubmit} disabled={createLog.isPending || sending}>
              {(createLog.isPending || sending) && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {sending ? "Verzenden..." : "Verzenden"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Phone dialog ---- */}
      <Dialog open={openDialog === "telefoon"} onOpenChange={(v) => { if (!v) { setOpenDialog(null); resetForm(); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nieuw telefoongesprek</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Klant</Label>
              <Select value={formCustomerId} onValueChange={setFormCustomerId}>
                <SelectTrigger><SelectValue placeholder="Selecteer klant" /></SelectTrigger>
                <SelectContent>
                  {customers?.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Richting</Label>
              <Select value={formDirection} onValueChange={setFormDirection}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="outbound">Uitgaand</SelectItem>
                  <SelectItem value="inbound">Inkomend</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notitie</Label>
              <Textarea value={formBody} onChange={(e) => setFormBody(e.target.value)} placeholder="Notitie van het gesprek..." rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpenDialog(null); resetForm(); }}>Annuleren</Button>
            <Button onClick={() => handleSimpleSubmit("telefoon")} disabled={createLog.isPending}>
              {createLog.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Opslaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Note dialog ---- */}
      <Dialog open={openDialog === "notitie"} onOpenChange={(v) => { if (!v) { setOpenDialog(null); resetForm(); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nieuwe notitie</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Klant</Label>
              <Select value={formCustomerId} onValueChange={setFormCustomerId}>
                <SelectTrigger><SelectValue placeholder="Selecteer klant" /></SelectTrigger>
                <SelectContent>
                  {customers?.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notitie</Label>
              <Textarea value={formBody} onChange={(e) => setFormBody(e.target.value)} placeholder="Typ je notitie..." rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpenDialog(null); resetForm(); }}>Annuleren</Button>
            <Button onClick={() => handleSimpleSubmit("notitie")} disabled={createLog.isPending}>
              {createLog.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Opslaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Generic dialog (Alle tab) ---- */}
      <Dialog open={openDialog === "generic"} onOpenChange={(v) => { if (!v) { setOpenDialog(null); resetForm(); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nieuw bericht / notitie</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Klant</Label>
              <Select value={formCustomerId} onValueChange={setFormCustomerId}>
                <SelectTrigger><SelectValue placeholder="Selecteer klant" /></SelectTrigger>
                <SelectContent>
                  {customers?.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <div className="space-y-2">
                <Label>Kanaal</Label>
                <Select value={formChannel} onValueChange={setFormChannel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="notitie">Notitie</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="telefoon">Telefoon</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Richting</Label>
                <Select value={formDirection} onValueChange={setFormDirection}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="outbound">Uitgaand</SelectItem>
                    <SelectItem value="inbound">Inkomend</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Onderwerp</Label>
              <Input value={formSubject} onChange={(e) => setFormSubject(e.target.value)} placeholder="Onderwerp (optioneel)" />
            </div>
            <div className="space-y-2">
              <Label>Bericht</Label>
              <Textarea value={formBody} onChange={(e) => setFormBody(e.target.value)} placeholder="Typ je bericht of notitie..." rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpenDialog(null); resetForm(); }}>Annuleren</Button>
            <Button onClick={handleGenericSubmit} disabled={createLog.isPending || sending}>
              {(createLog.isPending || sending) && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {formChannel === "email" && formDirection === "outbound" ? (sending ? "Verzenden..." : "Verzenden") : "Opslaan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bericht verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>Dit kan niet ongedaan worden gemaakt.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Verwijderen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ComposeWhatsAppDialog
        open={waDialogOpen}
        onOpenChange={setWaDialogOpen}
        customerPhone={customers?.find((c) => c.id === waCustomerId)?.phone || ""}
        customerId={waCustomerId || undefined}
        customerName={customers?.find((c) => c.id === waCustomerId)?.name}
      />

      {/* Auto-message config sheet */}
      <Sheet open={!!editingType} onOpenChange={(open) => { if (!open) setEditingType(null); }}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editingType ? LABELS[editingType] : ""}</SheetTitle>
          </SheetHeader>
          <div className="space-y-5 mt-6">
            <div className="flex items-center justify-between">
              <Label>Actief</Label>
              <Switch checked={sheetEnabled} onCheckedChange={setSheetEnabled} />
            </div>

            <div className="space-y-2">
              <Label>Kanaal</Label>
              <Select value={sheetChannel} onValueChange={(v) => setSheetChannel(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="both">Beide</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(sheetChannel === "whatsapp" || sheetChannel === "both") && (
              <div className="space-y-2">
                <Label>WhatsApp template</Label>
                <Select value={sheetTemplate} onValueChange={setSheetTemplate}>
                  <SelectTrigger><SelectValue placeholder="Selecteer template" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Geen</SelectItem>
                    {(waTemplates || [])
                      .filter((t: any) => t.status === "APPROVED")
                      .map((t: any) => (
                        <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(sheetChannel === "email" || sheetChannel === "both") && (
              <div className="space-y-2">
                <Label>E-mail tekst</Label>
                <Textarea
                  value={sheetCustomText}
                  onChange={(e) => setSheetCustomText(e.target.value)}
                  placeholder="Aangepaste e-mailtekst..."
                  rows={4}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Vertraging</Label>
              <Select value={sheetDelay} onValueChange={setSheetDelay}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Direct</SelectItem>
                  <SelectItem value="1">Na 1 uur</SelectItem>
                  <SelectItem value="2">Na 2 uur</SelectItem>
                  <SelectItem value="24">Na 1 dag</SelectItem>
                  <SelectItem value="48">Na 2 dagen</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleSaveAutoSetting} disabled={upsertSetting.isPending} className="w-full">
              {upsertSetting.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Opslaan
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default CommunicationPage;
