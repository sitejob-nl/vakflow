import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, MessageSquare, Plus, X } from "lucide-react";
import { useWhatsApp } from "@/hooks/useWhatsApp";
import { useWhatsAppTemplates } from "@/hooks/useWhatsAppTemplates";
import { useCreateCommunicationLog } from "@/hooks/useCommunicationLogs";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerPhone?: string;
  customerId?: string;
  customerName?: string;
}

type InteractiveButton = { id: string; title: string };
type InteractiveCTA = { text: string; url: string };

export default function ComposeWhatsAppDialog({ open, onOpenChange, customerPhone, customerId, customerName }: Props) {
  const [mode, setMode] = useState<"text" | "template" | "interactive">("text");
  const [phone, setPhone] = useState(customerPhone || "");
  const [message, setMessage] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [templateVars, setTemplateVars] = useState<Record<string, string>>({});

  // Interactive message state
  const [interactiveType, setInteractiveType] = useState<"button" | "list" | "cta_url">("button");
  const [interactiveHeader, setInteractiveHeader] = useState("");
  const [interactiveBody, setInteractiveBody] = useState("");
  const [interactiveFooter, setInteractiveFooter] = useState("");
  const [replyButtons, setReplyButtons] = useState<InteractiveButton[]>([{ id: "btn_1", title: "" }]);
  const [ctaButton, setCtaButton] = useState<InteractiveCTA>({ text: "", url: "" });
  const [listSections, setListSections] = useState([{ title: "", rows: [{ id: "row_1", title: "", description: "" }] }]);

  const sendWhatsApp = useWhatsApp();
  const createLog = useCreateCommunicationLog();
  const { data: templates, isLoading: templatesLoading } = useWhatsAppTemplates(open);

  const approvedTemplates = useMemo(
    () => (templates || []).filter((t: any) => t.status === "APPROVED"),
    [templates]
  );

  const activeTemplate = useMemo(
    () => approvedTemplates.find((t: any) => t.name === selectedTemplate),
    [approvedTemplates, selectedTemplate]
  );

  const templateBody = useMemo(() => {
    if (!activeTemplate) return "";
    const bodyComponent = activeTemplate.components?.find((c: any) => c.type === "BODY");
    return bodyComponent?.text || "";
  }, [activeTemplate]);

  const templateParams = useMemo(() => {
    const namedMatches = templateBody.match(/\{\{([a-z_]+)\}\}/g);
    if (namedMatches && namedMatches.length > 0) {
      return { type: "named" as const, keys: namedMatches.map(m => m.slice(2, -2)) };
    }
    const positionalMatches = templateBody.match(/\{\{(\d+)\}\}/g);
    if (positionalMatches && positionalMatches.length > 0) {
      return { type: "positional" as const, keys: positionalMatches.map(m => m.slice(2, -2)) };
    }
    return { type: "positional" as const, keys: [] as string[] };
  }, [templateBody]);

  const preview = useMemo(() => {
    let text = templateBody;
    for (const key of templateParams.keys) {
      text = text.replace(`{{${key}}}`, templateVars[key] || `[${key}]`);
    }
    return text;
  }, [templateBody, templateVars, templateParams]);

  const buildInteractivePayload = () => {
    const interactive: Record<string, any> = {
      body: { text: interactiveBody },
    };
    if (interactiveHeader) interactive.header = { type: "text", text: interactiveHeader };
    if (interactiveFooter) interactive.footer = { text: interactiveFooter };

    if (interactiveType === "button") {
      interactive.type = "button";
      interactive.action = {
        buttons: replyButtons.filter(b => b.title).map(b => ({
          type: "reply",
          reply: { id: b.id, title: b.title },
        })),
      };
    } else if (interactiveType === "cta_url") {
      interactive.type = "cta_url";
      interactive.action = {
        name: "cta_url",
        parameters: { display_text: ctaButton.text, url: ctaButton.url },
      };
    } else if (interactiveType === "list") {
      interactive.type = "list";
      interactive.action = {
        button: "Opties",
        sections: listSections.map(s => ({
          title: s.title,
          rows: s.rows.filter(r => r.title).map(r => ({ id: r.id, title: r.title, description: r.description })),
        })),
      };
    }
    return interactive;
  };

  const handleSend = async () => {
    const targetPhone = phone || customerPhone || "";
    if (!targetPhone) return;

    try {
      if (mode === "interactive") {
        const interactive = buildInteractivePayload();
        await sendWhatsApp.mutateAsync({
          to: targetPhone,
          type: "interactive",
          interactive,
          customer_id: customerId,
        });
      } else if (mode === "text") {
        await sendWhatsApp.mutateAsync({
          to: targetPhone,
          message,
          type: "text",
          customer_id: customerId,
        });
      } else {
        const components: any[] = [];
        if (templateParams.keys.length > 0) {
          const parameters = templateParams.keys.map((key) => {
            const param: any = { type: "text", text: templateVars[key] || "" };
            if (templateParams.type === "named") {
              param.parameter_name = key;
            }
            return param;
          });
          components.push({ type: "body", parameters });
        }
        await sendWhatsApp.mutateAsync({
          to: targetPhone,
          type: "template",
          template: {
            name: selectedTemplate,
            language: { code: activeTemplate?.language || "nl" },
            components,
          },
          customer_id: customerId,
          preview,
        });
      }

      // Log in communication_logs
      if (customerId) {
        await createLog.mutateAsync({
          customer_id: customerId,
          channel: "whatsapp",
          direction: "outbound",
          subject: mode === "template" ? `Template: ${selectedTemplate}` : mode === "interactive" ? "Interactief bericht" : null,
          body: mode === "text" ? message : mode === "template" ? preview : interactiveBody,
          is_automated: false,
          status: "sent",
          sent_at: new Date().toISOString(),
        });
      }

      // Reset & close
      resetForm();
      onOpenChange(false);
    } catch {
      // Error handled by useWhatsApp hook
    }
  };

  const resetForm = () => {
    setMessage("");
    setSelectedTemplate("");
    setTemplateVars({});
    setInteractiveHeader("");
    setInteractiveBody("");
    setInteractiveFooter("");
    setReplyButtons([{ id: "btn_1", title: "" }]);
    setCtaButton({ text: "", url: "" });
    setListSections([{ title: "", rows: [{ id: "row_1", title: "", description: "" }] }]);
  };

  const handleOpenChange = (val: boolean) => {
    if (val) {
      setPhone(customerPhone || "");
      setMode("text");
      resetForm();
    }
    onOpenChange(val);
  };

  const canSend = () => {
    if (!phone) return false;
    if (mode === "text") return !!message;
    if (mode === "template") return !!selectedTemplate;
    if (mode === "interactive") {
      if (!interactiveBody) return false;
      if (interactiveType === "button") return replyButtons.some(b => b.title);
      if (interactiveType === "cta_url") return !!ctaButton.text && !!ctaButton.url;
      if (interactiveType === "list") return listSections.some(s => s.rows.some(r => r.title));
      return false;
    }
    return false;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-accent" />
            WhatsApp versturen{customerName ? ` — ${customerName}` : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Telefoonnummer</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="06-12345678"
            />
          </div>

          {/* Mode toggle */}
          <div className="flex gap-1 bg-muted rounded-md p-1">
            {(["text", "template", "interactive"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 text-[12px] font-bold py-1.5 rounded-sm transition-colors ${
                  mode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                {m === "text" ? "Tekst" : m === "template" ? "Template" : "Interactief"}
              </button>
            ))}
          </div>

          {mode === "text" && (
            <div className="space-y-2">
              <Label>Bericht</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Typ je bericht..."
                rows={4}
              />
            </div>
          )}

          {mode === "template" && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Template</Label>
                {templatesLoading ? (
                  <div className="flex items-center gap-2 text-[12px] text-muted-foreground py-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Templates laden...
                  </div>
                ) : approvedTemplates.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground py-2">Geen goedgekeurde templates gevonden.</p>
                ) : (
                  <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                    <SelectTrigger><SelectValue placeholder="Kies een template" /></SelectTrigger>
                    <SelectContent>
                      {approvedTemplates.map((t: any) => (
                        <SelectItem key={t.name} value={t.name}>
                          {t.name} ({t.language})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {activeTemplate && templateParams.keys.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-[11px] text-muted-foreground">Variabelen</Label>
                  {templateParams.keys.map((key) => (
                    <Input
                      key={key}
                      placeholder={templateParams.type === "named" ? key : `Variabele {{${key}}}`}
                      value={templateVars[key] || ""}
                      onChange={(e) =>
                        setTemplateVars((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                    />
                  ))}
                </div>
              )}

              {activeTemplate && (
                <div className="bg-muted rounded-md p-3">
                  <Label className="text-[11px] text-muted-foreground mb-1 block">Preview</Label>
                  <p className="text-[13px] whitespace-pre-wrap">{preview}</p>
                </div>
              )}
            </div>
          )}

          {mode === "interactive" && (
            <div className="space-y-3">
              {/* Interactive type selector */}
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={interactiveType} onValueChange={(v) => setInteractiveType(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="button">Antwoordknoppen (max 3)</SelectItem>
                    <SelectItem value="list">Lijstmenu</SelectItem>
                    <SelectItem value="cta_url">CTA-URL knop</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] text-muted-foreground">Header (optioneel)</Label>
                <Input value={interactiveHeader} onChange={(e) => setInteractiveHeader(e.target.value)} placeholder="Koptekst" />
              </div>

              <div className="space-y-2">
                <Label>Berichttekst</Label>
                <Textarea value={interactiveBody} onChange={(e) => setInteractiveBody(e.target.value)} placeholder="Typ je bericht..." rows={3} />
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] text-muted-foreground">Footer (optioneel)</Label>
                <Input value={interactiveFooter} onChange={(e) => setInteractiveFooter(e.target.value)} placeholder="Voettekst" />
              </div>

              {/* Reply buttons */}
              {interactiveType === "button" && (
                <div className="space-y-2">
                  <Label className="text-[11px] text-muted-foreground">Knoppen (max 3)</Label>
                  {replyButtons.map((btn, i) => (
                    <div key={btn.id} className="flex items-center gap-2">
                      <Input
                        value={btn.title}
                        onChange={(e) => {
                          const next = [...replyButtons];
                          next[i] = { ...btn, title: e.target.value };
                          setReplyButtons(next);
                        }}
                        placeholder={`Knop ${i + 1}`}
                        maxLength={20}
                      />
                      {replyButtons.length > 1 && (
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0"
                          onClick={() => setReplyButtons(replyButtons.filter((_, j) => j !== i))}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {replyButtons.length < 3 && (
                    <Button variant="outline" size="sm" className="text-[11px]"
                      onClick={() => setReplyButtons([...replyButtons, { id: `btn_${replyButtons.length + 1}`, title: "" }])}>
                      <Plus className="h-3 w-3 mr-1" /> Knop toevoegen
                    </Button>
                  )}
                </div>
              )}

              {/* CTA URL */}
              {interactiveType === "cta_url" && (
                <div className="space-y-2">
                  <Label className="text-[11px] text-muted-foreground">CTA-knop</Label>
                  <Input value={ctaButton.text} onChange={(e) => setCtaButton({ ...ctaButton, text: e.target.value })} placeholder="Knoptekst" maxLength={20} />
                  <Input value={ctaButton.url} onChange={(e) => setCtaButton({ ...ctaButton, url: e.target.value })} placeholder="https://..." />
                </div>
              )}

              {/* List menu */}
              {interactiveType === "list" && (
                <div className="space-y-2">
                  <Label className="text-[11px] text-muted-foreground">Lijstopties</Label>
                  {listSections.map((section, si) => (
                    <div key={si} className="border border-border rounded-md p-2 space-y-1.5">
                      <Input value={section.title} onChange={(e) => {
                        const next = [...listSections];
                        next[si] = { ...section, title: e.target.value };
                        setListSections(next);
                      }} placeholder="Sectietitel" className="text-[12px]" />
                      {section.rows.map((row, ri) => (
                        <div key={row.id} className="flex gap-1.5">
                          <Input value={row.title} onChange={(e) => {
                            const next = [...listSections];
                            next[si].rows[ri] = { ...row, title: e.target.value };
                            setListSections(next);
                          }} placeholder="Optietitel" className="text-[12px] flex-1" maxLength={24} />
                          <Input value={row.description} onChange={(e) => {
                            const next = [...listSections];
                            next[si].rows[ri] = { ...row, description: e.target.value };
                            setListSections(next);
                          }} placeholder="Beschrijving" className="text-[12px] flex-1" maxLength={72} />
                        </div>
                      ))}
                      {section.rows.length < 10 && (
                        <Button variant="ghost" size="sm" className="text-[10px] h-6"
                          onClick={() => {
                            const next = [...listSections];
                            next[si].rows.push({ id: `row_${Date.now()}`, title: "", description: "" });
                            setListSections(next);
                          }}>
                          <Plus className="h-3 w-3 mr-1" /> Optie
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button onClick={handleSend} disabled={sendWhatsApp.isPending || !canSend()}>
            {sendWhatsApp.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Versturen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
