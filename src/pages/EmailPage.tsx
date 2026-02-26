import { useState, useMemo } from "react";
import { useCommunicationLogs, useCreateCommunicationLog, useDeleteCommunicationLog, useSendEmail } from "@/hooks/useCommunicationLogs";
import { useCustomers } from "@/hooks/useCustomers";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import {
  Loader2, Trash2, Mail, ChevronDown, ChevronUp, Search, RefreshCw, Plus,
  Inbox, Send as SendIcon, ArrowLeft, Reply,
} from "lucide-react";
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

const statusBadge: Record<string, { label: string; cls: string }> = {
  sent: { label: "Verzonden", cls: "bg-success-muted text-success" },
  failed: { label: "Mislukt", cls: "bg-destructive/10 text-destructive" },
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
  const [activeFilter, setActiveFilter] = useState<"all" | "inbound" | "outbound">("all");

  // Form
  const [formCustomerId, setFormCustomerId] = useState("");
  const [formSubject, setFormSubject] = useState("");
  const [formBody, setFormBody] = useState("");

  const emailLogs = useMemo(() => {
    let result = (logs ?? []).filter((l) => l.channel === "email");
    if (activeFilter !== "all") result = result.filter((l) => l.direction === activeFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((l) =>
        l.customers?.name?.toLowerCase().includes(q) ||
        l.subject?.toLowerCase().includes(q) ||
        l.body?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [logs, searchQuery, activeFilter]);

  const selected = useMemo(() => emailLogs.find((l) => l.id === selectedId), [emailLogs, selectedId]);

  const emailCustomers = useMemo(() => customers?.filter((c) => c.email) ?? [], [customers]);
  const selectedCustomer = customers?.find((c) => c.id === formCustomerId);

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
    if (!formCustomerId) { toast({ title: "Selecteer een klant", variant: "destructive" }); return; }
    if (!selectedCustomer?.email) { toast({ title: "Geen e-mailadres", variant: "destructive" }); return; }
    if (!formSubject || !formBody) { toast({ title: "Vul onderwerp en bericht in", variant: "destructive" }); return; }
    setSending(true);
    let status = "sent";
    try { await sendEmail.mutateAsync({ to: selectedCustomer.email, subject: formSubject, body: formBody }); }
    catch { status = "failed"; }
    try {
      await createLog.mutateAsync({
        customer_id: formCustomerId, channel: "email", subject: formSubject, body: formBody,
        direction: "outbound", is_automated: false, status, sent_at: new Date().toISOString(),
      });
      if (status === "sent") toast({ title: "E-mail verzonden" });
      else toast({ title: "E-mail verzending mislukt", variant: "destructive" });
      setComposeOpen(false);
      setFormCustomerId(""); setFormSubject(""); setFormBody("");
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
    setSending(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await deleteLog.mutateAsync(deleteTarget); toast({ title: "Verwijderd" }); if (selectedId === deleteTarget) setSelectedId(null); }
    catch (err: any) { toast({ title: "Fout", description: err.message, variant: "destructive" }); }
    setDeleteTarget(null);
  };

  const unreadCount = emailLogs.filter((l) => l.direction === "inbound" && l.status !== "read").length;

  // Detail view
  if (selected) {
    const dt = selected.sent_at ?? selected.created_at;
    const badge = statusBadge[selected.status] ?? statusBadge.sent;
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
            <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
              <span className="font-semibold text-foreground">{selected.customers?.name || "Onbekend"}</span>
              <span>·</span>
              <span>{selected.direction === "inbound" ? "Inkomend" : "Uitgaand"}</span>
              <span>·</span>
              <span className="font-mono">{format(new Date(dt), "d MMMM yyyy 'om' HH:mm", { locale: nl })}</span>
            </div>
          </div>
          <div className="px-5 py-5 text-[13px] text-foreground whitespace-pre-wrap leading-relaxed min-h-[200px]">
            {selected.body || "(leeg)"}
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

  return (
    <div>
      {/* Header bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Mail className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">E-mail</h1>
          {unreadCount > 0 && (
            <span className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
              {unreadCount} nieuw
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

      {/* Filters + search */}
      <div className="flex items-center gap-2 mb-3">
        {(["all", "inbound", "outbound"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`px-3 py-1.5 text-[12px] font-bold rounded-full transition-colors ${
              activeFilter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {f === "all" ? "Alle" : f === "inbound" ? "Inkomend" : "Verzonden"}
          </button>
        ))}
        <div className="relative flex-1 max-w-sm ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Zoek op klant, onderwerp of inhoud..."
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
            <p className="text-[13px] text-muted-foreground">Geen e-mails gevonden</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {emailLogs.map((m) => {
              const dt = m.sent_at ?? m.created_at;
              const badge = statusBadge[m.status] ?? statusBadge.sent;
              const isInbound = m.direction === "inbound";
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedId(m.id)}
                  className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/40 transition-colors group"
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 ${isInbound ? "bg-primary" : "bg-muted-foreground/30"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-bold truncate">
                        {m.customers?.name || "Onbekend"}
                      </span>
                      <span className="text-[11px] text-muted-foreground truncate flex-1">
                        {m.subject || "(geen onderwerp)"}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                        {format(new Date(dt), "dd MMM HH:mm", { locale: nl })}
                      </span>
                    </div>
                    {m.body && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{m.body}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isInbound && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary-muted text-primary">IN</span>
                    )}
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
      <Dialog open={composeOpen} onOpenChange={(v) => { if (!v) { setComposeOpen(false); setFormCustomerId(""); setFormSubject(""); setFormBody(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nieuwe e-mail</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Klant</Label>
              <Select value={formCustomerId} onValueChange={setFormCustomerId}>
                <SelectTrigger><SelectValue placeholder="Selecteer klant" /></SelectTrigger>
                <SelectContent>
                  {emailCustomers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {selectedCustomer?.email && (
                <p className="text-[11px] text-muted-foreground">Aan: {selectedCustomer.email}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Onderwerp</Label>
              <Input value={formSubject} onChange={(e) => setFormSubject(e.target.value)} placeholder="Onderwerp" />
            </div>
            <div className="space-y-2">
              <Label>Bericht</Label>
              <Textarea value={formBody} onChange={(e) => setFormBody(e.target.value)} placeholder="Typ je bericht..." rows={8} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComposeOpen(false)}>Annuleren</Button>
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
