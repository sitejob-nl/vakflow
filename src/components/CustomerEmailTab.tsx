import { useState, useMemo } from "react";
import { Mail, Send, FileText } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useCommunicationLogs, useCreateCommunicationLog, useSendEmail } from "@/hooks/useCommunicationLogs";
import { useEmailTemplates } from "@/hooks/useEmailTemplates";
import { useAuth } from "@/contexts/AuthContext";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Props {
  customerId: string;
  customerEmail: string | null;
  customerName: string;
}

const CustomerEmailTab = ({ customerId, customerEmail, customerName }: Props) => {
  const { companyId } = useAuth();
  const { toast } = useToast();
  const { data: allLogs } = useCommunicationLogs(customerId, companyId);
  const { data: templates } = useEmailTemplates();
  const sendEmail = useSendEmail();
  const createLog = useCreateCommunicationLog();

  const [mode, setMode] = useState<"list" | "compose" | "template">("list");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [sending, setSending] = useState(false);

  const emailLogs = useMemo(
    () => (allLogs ?? []).filter((l) => l.channel === "email"),
    [allLogs]
  );

  const selectedTemplate = templates?.find((t) => t.id === selectedTemplateId);

  const resolveVars = (text: string) =>
    text
      .replace(/\{\{klantnaam\}\}/gi, customerName)
      .replace(/\{\{datum\}\}/gi, format(new Date(), "dd-MM-yyyy"));

  const handleSendFree = async () => {
    if (!customerEmail) return toast({ title: "Geen e-mailadres", variant: "destructive" });
    if (!subject.trim()) return toast({ title: "Onderwerp is verplicht", variant: "destructive" });
    setSending(true);
    try {
      await sendEmail.mutateAsync({ to: customerEmail, subject, body });
      await createLog.mutateAsync({
        customer_id: customerId,
        channel: "email",
        direction: "outbound",
        subject,
        body,
        status: "sent",
        sent_at: new Date().toISOString(),
      } as any);
      toast({ title: "E-mail verzonden" });
      setSubject("");
      setBody("");
      setMode("list");
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleSendTemplate = async () => {
    if (!customerEmail) return toast({ title: "Geen e-mailadres", variant: "destructive" });
    if (!selectedTemplate) return;
    const resolvedSubject = resolveVars(selectedTemplate.subject || selectedTemplate.name);
    const resolvedBody = resolveVars(selectedTemplate.html_body);
    setSending(true);
    try {
      await sendEmail.mutateAsync({ to: customerEmail, subject: resolvedSubject, body: resolvedBody });
      await createLog.mutateAsync({
        customer_id: customerId,
        channel: "email",
        direction: "outbound",
        subject: resolvedSubject,
        body: resolvedBody,
        template_name: selectedTemplate.name,
        is_automated: false,
        status: "sent",
        sent_at: new Date().toISOString(),
      } as any);
      toast({ title: "Template e-mail verzonden" });
      setSelectedTemplateId("");
      setMode("list");
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      {/* Action buttons */}
      <div className="px-4 py-3 border-b border-border flex gap-2 flex-wrap">
        <button
          onClick={() => setMode(mode === "compose" ? "list" : "compose")}
          className={`px-3 py-1.5 rounded-sm text-[12px] font-bold flex items-center gap-1.5 transition-colors ${mode === "compose" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-secondary-foreground hover:bg-bg-hover"}`}
        >
          <Mail className="w-3.5 h-3.5" /> Nieuwe e-mail
        </button>
        <button
          onClick={() => setMode(mode === "template" ? "list" : "template")}
          className={`px-3 py-1.5 rounded-sm text-[12px] font-bold flex items-center gap-1.5 transition-colors ${mode === "template" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-secondary-foreground hover:bg-bg-hover"}`}
        >
          <FileText className="w-3.5 h-3.5" /> Template versturen
        </button>
      </div>

      {/* Compose free email */}
      {mode === "compose" && (
        <div className="px-4 py-4 border-b border-border space-y-3">
          <div>
            <label className="text-[11px] font-bold text-t3 mb-1 block">Aan</label>
            <Input value={customerEmail || ""} disabled className="text-[13px]" />
          </div>
          <div>
            <label className="text-[11px] font-bold text-t3 mb-1 block">Onderwerp</label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Onderwerp…" className="text-[13px]" />
          </div>
          <div>
            <label className="text-[11px] font-bold text-t3 mb-1 block">Bericht</label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Typ uw bericht…" rows={5} className="text-[13px]" />
          </div>
          <button
            onClick={handleSendFree}
            disabled={sending || !customerEmail}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-sm text-[12px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" /> {sending ? "Verzenden…" : "Verstuur"}
          </button>
        </div>
      )}

      {/* Template send */}
      {mode === "template" && (
        <div className="px-4 py-4 border-b border-border space-y-3">
          <div>
            <label className="text-[11px] font-bold text-t3 mb-1 block">Template kiezen</label>
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger className="text-[13px]">
                <SelectValue placeholder="Selecteer een template…" />
              </SelectTrigger>
              <SelectContent>
                {templates?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedTemplate && (
            <>
              <div className="bg-muted rounded-md p-3">
                <p className="text-[11px] font-bold text-t3 mb-1">Onderwerp: {resolveVars(selectedTemplate.subject || selectedTemplate.name)}</p>
                <div className="text-[12px] text-secondary-foreground mt-2 max-h-[200px] overflow-y-auto" dangerouslySetInnerHTML={{ __html: resolveVars(selectedTemplate.html_body) }} />
              </div>
              <button
                onClick={handleSendTemplate}
                disabled={sending || !customerEmail}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-sm text-[12px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" /> {sending ? "Verzenden…" : "Verstuur template"}
              </button>
            </>
          )}
        </div>
      )}

      {/* Email history */}
      {emailLogs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Nog geen e-mails voor deze klant.</div>
      ) : (
        <div className="divide-y divide-border">
          {emailLogs.map((m) => {
            const dt = m.sent_at ?? m.created_at;
            const isInbound = m.direction === "inbound";
            return (
              <div key={m.id} className="px-4 py-3 hover:bg-bg-hover transition-colors">
                <div className="flex items-start gap-2.5">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${isInbound ? "bg-accent-muted text-accent" : "bg-primary-muted text-primary"}`}>
                    <Mail className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-1.5 py-[1px] rounded ${isInbound ? "bg-accent-muted text-accent" : "bg-primary-muted text-primary"}`}>
                        {isInbound ? "Inkomend" : "Verzonden"}
                      </span>
                      {m.template_name && (
                        <span className="text-[10px] font-bold px-1.5 py-[1px] rounded bg-muted text-muted-foreground">{m.template_name}</span>
                      )}
                      <span className="text-[10px] text-t3 font-mono ml-auto">{format(new Date(dt), "dd-MM-yyyy HH:mm", { locale: nl })}</span>
                    </div>
                    {m.subject && <p className="text-[12px] font-bold mt-1">{m.subject}</p>}
                    {m.body && <p className="text-[11.5px] text-secondary-foreground mt-0.5 line-clamp-2">{m.body}</p>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CustomerEmailTab;
