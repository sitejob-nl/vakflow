import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, MessageSquare } from "lucide-react";
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

export default function ComposeWhatsAppDialog({ open, onOpenChange, customerPhone, customerId, customerName }: Props) {
  const [mode, setMode] = useState<"text" | "template">("text");
  const [phone, setPhone] = useState(customerPhone || "");
  const [message, setMessage] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [templateVars, setTemplateVars] = useState<Record<string, string>>({});

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

  // Extract variables from template body — supports both positional {{1}} and named {{first_name}}
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

  // Live preview with filled variables
  const preview = useMemo(() => {
    let text = templateBody;
    for (const key of templateParams.keys) {
      text = text.replace(`{{${key}}}`, templateVars[key] || `[${key}]`);
    }
    return text;
  }, [templateBody, templateVars, templateParams]);

  const handleSend = async () => {
    const targetPhone = phone || customerPhone || "";
    if (!targetPhone) return;

    try {
      if (mode === "text") {
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
        });
      }

      // Log in communication_logs
      if (customerId) {
        await createLog.mutateAsync({
          customer_id: customerId,
          channel: "whatsapp",
          direction: "outbound",
          subject: mode === "template" ? `Template: ${selectedTemplate}` : null,
          body: mode === "text" ? message : preview,
          is_automated: false,
          status: "sent",
          sent_at: new Date().toISOString(),
        });
      }

      // Reset & close
      setMessage("");
      setSelectedTemplate("");
      setTemplateVars({});
      onOpenChange(false);
    } catch {
      // Error handled by useWhatsApp hook
    }
  };

  // Reset phone when dialog opens with new customer
  const handleOpenChange = (val: boolean) => {
    if (val) {
      setPhone(customerPhone || "");
      setMessage("");
      setSelectedTemplate("");
      setTemplateVars({});
      setMode("text");
    }
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
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
            <button
              onClick={() => setMode("text")}
              className={`flex-1 text-[12px] font-bold py-1.5 rounded-sm transition-colors ${
                mode === "text" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              Tekst
            </button>
            <button
              onClick={() => setMode("template")}
              className={`flex-1 text-[12px] font-bold py-1.5 rounded-sm transition-colors ${
                mode === "template" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              Template
            </button>
          </div>

          {mode === "text" ? (
            <div className="space-y-2">
              <Label>Bericht</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Typ je bericht..."
                rows={4}
              />
            </div>
          ) : (
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button
            onClick={handleSend}
            disabled={
              sendWhatsApp.isPending ||
              !phone ||
              (mode === "text" && !message) ||
              (mode === "template" && !selectedTemplate)
            }
          >
            {sendWhatsApp.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Versturen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
