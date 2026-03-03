import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useCommunicationLogs, useCreateCommunicationLog, useDeleteCommunicationLog, useSendEmail } from "@/hooks/useCommunicationLogs";
import { useCustomers } from "@/hooks/useCustomers";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import {
  Loader2, Trash2, Mail, Search, RefreshCw, Plus,
  Inbox, ArrowLeft, User, Send, FileEdit, FolderOpen,
  ArrowDownLeft, ArrowUpRight,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import CustomerCombobox from "@/components/CustomerCombobox";

const statusBadge: Record<string, { label: string; cls: string }> = {
  sent: { label: "Verzonden", cls: "bg-success-muted text-success" },
  failed: { label: "Mislukt", cls: "bg-destructive/10 text-destructive" },
  draft: { label: "Concept", cls: "bg-muted text-muted-foreground" },
};

type FolderKey = "all" | "inbox" | "sent" | "drafts";

const folders: { key: FolderKey; label: string; icon: React.ReactNode }[] = [
  { key: "all", label: "Alle", icon: <FolderOpen className="h-3.5 w-3.5" /> },
  { key: "inbox", label: "Inbox", icon: <Inbox className="h-3.5 w-3.5" /> },
  { key: "sent", label: "Verzonden", icon: <Send className="h-3.5 w-3.5" /> },
  { key: "drafts", label: "Concepten", icon: <FileEdit className="h-3.5 w-3.5" /> },
];

/* ── Sandboxed HTML renderer via iframe ── */
const HtmlEmailViewer = ({ html }: { html: string }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(300);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const onLoad = () => {
      try {
        const doc = iframe.contentDocument;
        if (doc) {
          const style = doc.createElement("style");
          style.textContent = `
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #1a1a1a; margin: 0; padding: 16px; word-break: break-word; }
            img { max-width: 100%; height: auto; }
            a { color: #2563eb; }
            table { max-width: 100% !important; }
          `;
          doc.head?.appendChild(style);
          const h = doc.body?.scrollHeight || 300;
          setHeight(Math.min(Math.max(h, 200), 800));
        }
      } catch {
        // cross-origin, ignore
      }
    };

    iframe.addEventListener("load", onLoad);
    return () => iframe.removeEventListener("load", onLoad);
  }, [html]);

  return (
    <iframe
      ref={iframeRef}
      srcDoc={html}
      sandbox="allow-same-origin"
      className="w-full border-0"
      style={{ height }}
      title="E-mail inhoud"
    />
  );
};

const EmailPage = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: logs, isLoading } = useCommunicationLogs();
  const { data: customers } = useCustomers();
  const createLog = useCreateCommunicationLog();
  const deleteLog = useDeleteCommunicationLog();
  const sendEmail = useSendEmail();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [sending, setSending] = useState(false);
  const [activeFolder, setActiveFolder] = useState<FolderKey>("inbox");

  // Realtime subscription for automatic refresh
  useEffect(() => {
    const channel = supabase
      .channel("communication_logs_realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "communication_logs" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["communication_logs"] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Compose form
  const [formCustomerId, setFormCustomerId] = useState("");
  const [formToEmail, setFormToEmail] = useState("");
  const [formSubject, setFormSubject] = useState("");
  const [formBody, setFormBody] = useState("");

  const emailLogs = useMemo(() => {
    let result = (logs ?? []).filter((l) => l.channel === "email");

    // Filter by folder
    if (activeFolder !== "all") {
      result = result.filter((l) => {
        const folder = (l as any).folder_name || (l.direction === "outbound" ? "sent" : "inbox");
        return folder === activeFolder;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((l) =>
        l.customers?.name?.toLowerCase().includes(q) ||
        l.subject?.toLowerCase().includes(q) ||
        l.body?.toLowerCase().includes(q) ||
        (l as any).sender_email?.toLowerCase().includes(q) ||
        (l as any).sender_name?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [logs, searchQuery, activeFolder]);

  // Folder counts
  const folderCounts = useMemo(() => {
    const all = (logs ?? []).filter((l) => l.channel === "email");
    const counts: Record<FolderKey, number> = { all: all.length, inbox: 0, sent: 0, drafts: 0 };
    for (const l of all) {
      const folder = (l as any).folder_name || (l.direction === "outbound" ? "sent" : "inbox");
      if (folder in counts) counts[folder as FolderKey]++;
    }
    return counts;
  }, [logs]);

  const selected = useMemo(() => emailLogs.find((l) => l.id === selectedId), [emailLogs, selectedId]);

  const emailCustomers = useMemo(() => customers?.filter((c) => c.email) ?? [], [customers]);

  const handleCustomerChange = useCallback((customerId: string) => {
    setFormCustomerId(customerId);
    const cust = customers?.find((c) => c.id === customerId);
    if (cust?.email) setFormToEmail(cust.email);
  }, [customers]);

  const getSenderDisplay = (m: any) => {
    const folder = m.folder_name || (m.direction === "outbound" ? "sent" : "inbox");
    // For sent items, show recipient info
    if (folder === "sent") {
      if (m.customers?.name) return `Aan: ${m.customers.name}`;
      if (m.sender_name) return `Aan: ${m.sender_name}`;
      if (m.sender_email) return `Aan: ${m.sender_email}`;
      return "Verzonden";
    }
    if (m.sender_name) return m.sender_name;
    if (m.sender_email) return m.sender_email;
    if (m.customers?.name) return m.customers.name;
    return "Onbekend";
  };

  const handleFetchEmails = async () => {
    setFetching(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Niet ingelogd");
      const res = await fetch(
        `https://sigzpqwnavfxtvbyqvzj.supabase.co/functions/v1/fetch-emails`,
        { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` } }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Ophalen mislukt");
      queryClient.invalidateQueries({ queryKey: ["communication_logs"] });
      toast({ title: json.fetched > 0 ? `${json.fetched} nieuwe e-mail(s) opgehaald` : "Geen nieuwe e-mails" });
    } catch (err: any) {
      toast({ title: "Fout bij ophalen", description: err.message, variant: "destructive" });
    }
    setFetching(false);
  };

  const handleSend = async () => {
    if (!formToEmail) { toast({ title: "Vul een e-mailadres in", variant: "destructive" }); return; }
    if (!formSubject || !formBody) { toast({ title: "Vul onderwerp en bericht in", variant: "destructive" }); return; }
    setSending(true);
    let status = "sent";
    try { await sendEmail.mutateAsync({ to: formToEmail, subject: formSubject, body: formBody }); }
    catch { status = "failed"; }
    try {
      await createLog.mutateAsync({
        customer_id: formCustomerId || null,
        channel: "email",
        subject: formSubject,
        body: formBody,
        direction: "outbound",
        folder_name: "sent",
        is_automated: false,
        status,
        sent_at: new Date().toISOString(),
      } as any);
      if (status === "sent") toast({ title: "E-mail verzonden" });
      else toast({ title: "E-mail verzending mislukt", variant: "destructive" });
      setComposeOpen(false);
      resetForm();
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
    setSending(false);
  };

  const resetForm = () => {
    setFormCustomerId("");
    setFormToEmail("");
    setFormSubject("");
    setFormBody("");
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await deleteLog.mutateAsync(deleteTarget); toast({ title: "Verwijderd" }); if (selectedId === deleteTarget) setSelectedId(null); }
    catch (err: any) { toast({ title: "Fout", description: err.message, variant: "destructive" }); }
    setDeleteTarget(null);
  };

  const inboxUnread = useMemo(() => {
    return (logs ?? []).filter((l) => l.channel === "email" && l.direction === "inbound" && l.status !== "read").length;
  }, [logs]);

  // ── Detail view ──
  if (selected) {
    const dt = selected.sent_at ?? selected.created_at;
    const badge = statusBadge[selected.status] ?? statusBadge.sent;
    const senderName = getSenderDisplay(selected);
    const senderEmail = (selected as any).sender_email || "";
    const htmlBody = (selected as any).html_body;

    return (
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Terug
          </Button>
        </div>
        <div className="bg-card border border-border rounded-lg shadow-card">
          <div className="px-5 py-4 border-b border-border">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-bold">{selected.subject || "(geen onderwerp)"}</h2>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${badge.cls}`}>{badge.label}</span>
            </div>
            <div className="flex items-center gap-3 text-[12px] text-muted-foreground flex-wrap">
              <div className="flex items-center gap-1.5">
                <User className="h-3 w-3" />
                <span className="font-semibold text-foreground">{senderName}</span>
                {senderEmail && senderEmail !== senderName && !senderName.startsWith("Aan:") && (
                  <span className="text-muted-foreground">&lt;{senderEmail}&gt;</span>
                )}
              </div>
              <span>·</span>
              <span>{selected.direction === "inbound" ? "Inkomend" : "Uitgaand"}</span>
              <span>·</span>
              <span className="font-mono">{format(new Date(dt), "d MMMM yyyy 'om' HH:mm", { locale: nl })}</span>
            </div>
            {selected.customers?.name && !senderName.includes(selected.customers.name) && (
              <div className="mt-1 text-[11px] text-muted-foreground">
                Klant: <span className="font-medium text-foreground">{selected.customers.name}</span>
              </div>
            )}
          </div>

          <div className="min-h-[200px]">
            {htmlBody ? (
              <HtmlEmailViewer html={htmlBody} />
            ) : (
              <div className="px-5 py-5 text-[13px] text-foreground whitespace-pre-wrap leading-relaxed">
                {selected.body || "(leeg)"}
              </div>
            )}
          </div>

          <div className="px-5 py-3 border-t border-border flex items-center gap-2">
            {!selected.is_automated && (
              <Button variant="ghost" size="sm" className="text-destructive gap-1.5" onClick={() => setDeleteTarget(selected.id)}>
                <Trash2 className="h-3.5 w-3.5" /> Verwijderen
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── List view ──
  return (
    <div>
      {/* Header bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Mail className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">E-mail</h1>
          {inboxUnread > 0 && (
            <span className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
              {inboxUnread} nieuw
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleFetchEmails} disabled={fetching}>
            {fetching ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
            Ophalen
          </Button>
          <Button size="sm" onClick={() => setComposeOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Nieuwe e-mail
          </Button>
        </div>
      </div>

      {/* Folder tabs + search */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {folders.map((f) => (
          <button
            key={f.key}
            onClick={() => { setActiveFolder(f.key); setSelectedId(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold rounded-full transition-colors ${
              activeFolder === f.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {f.icon}
            {f.label}
            {folderCounts[f.key] > 0 && (
              <span className={`text-[10px] ml-0.5 ${activeFolder === f.key ? "text-primary-foreground/70" : "text-muted-foreground/60"}`}>
                {folderCounts[f.key]}
              </span>
            )}
          </button>
        ))}
        <div className="relative flex-1 max-w-sm ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Zoek op afzender, onderwerp of inhoud..."
            className="h-8 pl-8 text-[12px]"
          />
        </div>
      </div>

      {/* Email list */}
      <div className="bg-card border border-border rounded-lg shadow-card overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : emailLogs.length === 0 ? (
          <div className="text-center py-12">
            <Inbox className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-[13px] text-muted-foreground">
              {activeFolder === "drafts" ? "Geen concepten" : activeFolder === "sent" ? "Geen verzonden e-mails" : "Geen e-mails gevonden"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {emailLogs.map((m) => {
              const dt = m.sent_at ?? m.created_at;
              const badge = statusBadge[m.status] ?? statusBadge.sent;
              const isInbound = m.direction === "inbound";
              const sender = getSenderDisplay(m);
              const preview = m.body || "";

              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedId(m.id)}
                  className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/40 transition-colors group"
                >
                  <div className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center ${
                    m.status === "draft" ? "bg-muted text-muted-foreground" : isInbound ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                  }`}>
                    {isInbound ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-bold truncate max-w-[180px]">
                        {sender}
                      </span>
                      <span className="text-[11px] text-muted-foreground truncate flex-1">
                        {m.subject || "(geen onderwerp)"}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                        {format(new Date(dt), "dd MMM HH:mm", { locale: nl })}
                      </span>
                    </div>
                    {preview && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{preview}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${badge.cls}`}>{badge.label}</span>
                    {!m.is_automated && (
                      <span
                        role="button"
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(m.id); }}
                        className="md:opacity-0 md:group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Compose dialog */}
      <Dialog open={composeOpen} onOpenChange={(v) => { if (!v) { setComposeOpen(false); resetForm(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nieuwe e-mail</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Klant (optioneel)</Label>
              <CustomerCombobox
                customers={emailCustomers}
                value={formCustomerId}
                onValueChange={handleCustomerChange}
                placeholder="Selecteer klant..."
              />
            </div>
            <div className="space-y-2">
              <Label>Aan (e-mailadres) *</Label>
              <Input
                type="email"
                value={formToEmail}
                onChange={(e) => setFormToEmail(e.target.value)}
                placeholder="naam@voorbeeld.nl"
              />
            </div>
            <div className="space-y-2">
              <Label>Onderwerp *</Label>
              <Input value={formSubject} onChange={(e) => setFormSubject(e.target.value)} placeholder="Onderwerp" />
            </div>
            <div className="space-y-2">
              <Label>Bericht *</Label>
              <Textarea value={formBody} onChange={(e) => setFormBody(e.target.value)} placeholder="Typ je bericht..." rows={8} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setComposeOpen(false); resetForm(); }}>Annuleren</Button>
            <Button onClick={handleSend} disabled={sending || createLog.isPending}>
              {(sending || createLog.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {sending ? "Verzenden..." : "Verzenden"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>E-mail verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>Dit kan niet ongedaan worden gemaakt.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Verwijderen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EmailPage;