import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useSignedUrl } from "@/hooks/useSignedUrl";
import { useWhatsAppMessages } from "@/hooks/useWhatsAppMessages";
import { useWhatsApp } from "@/hooks/useWhatsApp";
import { useWhatsAppStatus } from "@/hooks/useWhatsAppStatus";
import { useWhatsAppTemplates } from "@/hooks/useWhatsAppTemplates";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import {
  Send, Loader2, CheckCheck, Check, Clock, AlertCircle,
  Image as ImageIcon, FileText, Mic, Smile, XCircle, ChevronDown, Bot, ArrowRight, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface WhatsAppChatProps {
  customerId: string;
  customerPhone?: string | null;
  customerName?: string;
  aiActive?: boolean;
  aiConversationId?: string | null;
}

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "🙏", "👏", "🎉", "🙌"];

const StatusIcon = ({ status }: { status: string | null }) => {
  switch (status) {
    case "read":
      return <CheckCheck className="h-3 w-3 text-primary" />;
    case "delivered":
      return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
    case "sent":
      return <Check className="h-3 w-3 text-muted-foreground" />;
    case "failed":
      return <AlertCircle className="h-3 w-3 text-destructive" />;
    default:
      return <Clock className="h-3 w-3 text-muted-foreground" />;
  }
};

export default function WhatsAppChat({ customerId, customerPhone, customerName, aiActive, aiConversationId }: WhatsAppChatProps) {
  const { companyId } = useAuth();
  const navigate = useNavigate();
  const { data: messages, isLoading } = useWhatsAppMessages(customerId, companyId);
  const { data: waStatus } = useWhatsAppStatus();
  const { data: templates } = useWhatsAppTemplates(!!waStatus?.connected);
  const sendWhatsApp = useWhatsApp();
  const queryClient = useQueryClient();

  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState<"text" | "template">("text");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [templateVars, setTemplateVars] = useState<string[]>([]);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [aiDismissed, setAiDismissed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const approvedTemplates = useMemo(
    () => (templates ?? []).filter((t: any) => t.status === "APPROVED"),
    [templates]
  );

  const activeTemplate = useMemo(
    () => approvedTemplates.find((t: any) => t.name === selectedTemplate),
    [approvedTemplates, selectedTemplate]
  );

  const templateParams = useMemo(() => {
    if (!activeTemplate) return { type: "positional" as const, keys: [] as string[] };
    const bodyComp = activeTemplate.components?.find((c: any) => c.type === "BODY");
    const bodyText = bodyComp?.text || "";
    const namedMatches = bodyText.match(/\{\{([a-z_]+)\}\}/g);
    if (namedMatches && namedMatches.length > 0) {
      return { type: "named" as const, keys: namedMatches.map((m: string) => m.slice(2, -2)) };
    }
    const positionalMatches = bodyText.match(/\{\{(\d+)\}\}/g);
    if (positionalMatches && positionalMatches.length > 0) {
      return { type: "positional" as const, keys: positionalMatches.map((m: string) => m.slice(2, -2)) };
    }
    return { type: "positional" as const, keys: [] as string[] };
  }, [activeTemplate]);

  const [templateVarMap, setTemplateVarMap] = useState<Record<string, string>>({});

  useEffect(() => {
    setTemplateVarMap({});
    setTemplateVars([]);
  }, [selectedTemplate]);

  // Sort messages chronologically (oldest first)
  const sortedMessages = useMemo(
    () => [...(messages ?? [])].sort(
      (a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()
    ),
    [messages]
  );

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sortedMessages.length]);

  // Track which wamids have already been marked as read
  const markedReadRef = useRef(new Set<string>());

  // Mark incoming as read on view
  useEffect(() => {
    const unread = sortedMessages.filter(
      (m) => (m.direction === "incoming" || m.direction === "inbound") && m.status !== "read" && m.wamid && !markedReadRef.current.has(m.wamid)
    );
    if (unread.length === 0) return;
    unread.forEach((m) => {
      markedReadRef.current.add(m.wamid!);
      supabase.functions.invoke("whatsapp-send", {
        body: { action: "mark_read", message_id: m.wamid, typing_indicator: true },
      });
    });
    queryClient.invalidateQueries({ queryKey: ["whatsapp-messages"] });
  }, [sortedMessages, queryClient]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 16 * 1024 * 1024) {
      toast.error("Bestand is te groot (max 16 MB)");
      return;
    }
    setPendingFile(file);
    if (file.type.startsWith("image/")) {
      setPendingPreview(URL.createObjectURL(file));
    } else {
      setPendingPreview(null);
    }
    e.target.value = "";
  };

  const clearPendingFile = () => {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingFile(null);
    setPendingPreview(null);
  };

  // Hand off AI conversation
  const handleAiHandOff = async () => {
    if (!aiConversationId) return;
    await supabase
      .from("ai_conversations")
      .update({ status: "handed_off" })
      .eq("id", aiConversationId);
    queryClient.invalidateQueries({ queryKey: ["active-ai-conversations"] });
    setAiDismissed(true);
    toast.success("AI agent is uitgeschakeld voor dit gesprek. U neemt het over.");
  };

  const handleSend = async () => {
    if (!customerPhone) {
      toast.error("Geen telefoonnummer bekend");
      return;
    }

    // If AI is active, automatically hand off when user sends a message
    if (aiActive && !aiDismissed && aiConversationId) {
      await handleAiHandOff();
    }

    setSending(true);
    try {
      if (mode === "template" && activeTemplate) {
        const parameters = templateParams.keys.map((key) => {
          const param: any = { type: "text", text: templateVarMap[key] || "-" };
          if (templateParams.type === "named") param.parameter_name = key;
          return param;
        });
        const bodyComp = activeTemplate.components?.find((c: any) => c.type === "BODY");
        let previewText = bodyComp?.text ?? "";
        templateParams.keys.forEach((key) => {
          previewText = previewText.replace(`{{${key}}}`, templateVarMap[key] || `{{${key}}}`);
        });

        await sendWhatsApp.mutateAsync({
          to: customerPhone,
          type: "template",
          template: {
            name: activeTemplate.name,
            language: { code: activeTemplate.language || "nl" },
            components: parameters.length > 0
              ? [{ type: "body", parameters }]
              : [],
          },
          customer_id: customerId,
          preview: previewText,
        });
      } else if (pendingFile) {
        const ext = pendingFile.name.split(".").pop() || "bin";
        const fileType = pendingFile.type.startsWith("image/") ? "image"
          : pendingFile.type.startsWith("video/") ? "video"
          : pendingFile.type.startsWith("audio/") ? "audio"
          : "document";
        const storagePath = `${companyId}/${fileType}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("whatsapp-media")
          .upload(storagePath, pendingFile, { contentType: pendingFile.type });
        if (uploadError) throw new Error(`Upload mislukt: ${uploadError.message}`);

        const { data: signedData, error: signError } = await supabase.storage
          .from("whatsapp-media")
          .createSignedUrl(storagePath, 3600);
        if (signError || !signedData?.signedUrl) throw new Error("Signed URL mislukt");

        await sendWhatsApp.mutateAsync({
          to: customerPhone,
          type: fileType,
          link: signedData.signedUrl,
          caption: message.trim() || undefined,
          filename: fileType === "document" ? pendingFile.name : undefined,
          customer_id: customerId,
        });
        clearPendingFile();
      } else {
        if (!message.trim()) return;
        await sendWhatsApp.mutateAsync({
          to: customerPhone,
          type: "text",
          message: message.trim(),
          preview_url: true,
          customer_id: customerId,
        });
      }
      setMessage("");
      setSelectedTemplate("");
      setTemplateVars([]);
      setMode("text");
    } catch {
      // error toast handled by hook
    }
    setSending(false);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && mode === "text" && !pendingFile) {
      e.preventDefault();
      handleSend();
    }
  };

  // Check if a message is likely sent by AI (outgoing, no explicit user sender)
  const isAiMessage = (msg: typeof sortedMessages[0]) => {
    if (msg.direction !== "outgoing") return false;
    // Messages sent by AI typically have no sent_by field or metadata indicating user
    const meta = msg.metadata as Record<string, any> | null;
    if (meta?.sent_by_user) return false;
    if (meta?.sent_by === "ai" || meta?.ai_generated) return true;
    // Heuristic: if there's no user attribution and it's outgoing, could be AI
    // We check for a specific marker; if none exists, we don't show AI label
    return false;
  };

  const MediaRenderer = ({ msg }: { msg: typeof sortedMessages[0] }) => {
    const storageUrl = msg.metadata?.storage_url;
    const signedUrl = useSignedUrl("whatsapp-media", storageUrl as string | undefined);
    if (!signedUrl) return null;

    switch (msg.type) {
      case "image":
      case "sticker":
        return (
          <a href={signedUrl} target="_blank" rel="noopener noreferrer">
            <img src={signedUrl} alt={msg.content || "Media"} className="rounded-md max-w-[220px] max-h-[160px] object-cover" loading="lazy" />
          </a>
        );
      case "video":
        return <video src={signedUrl} controls preload="metadata" className="rounded-md max-w-[240px] max-h-[180px]" />;
      case "audio":
        return (
          <div className="flex items-center gap-1.5">
            <Mic className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <audio src={signedUrl} controls preload="metadata" className="h-8 max-w-[200px]" />
          </div>
        );
      case "document":
        return (
          <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-background/50 text-[11px] hover:bg-background transition-colors">
            <FileText className="h-3.5 w-3.5 shrink-0" />
            {msg.metadata?.document?.filename || "Document"}
          </a>
        );
      default:
        return null;
    }
  };

  if (!waStatus?.connected) {
    return (
      <div className="text-center py-12">
        <XCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-[13px] text-muted-foreground">WhatsApp is niet gekoppeld.</p>
        <p className="text-[11px] text-t3 mt-1">Ga naar Instellingen → WhatsApp om te koppelen.</p>
      </div>
    );
  }

  if (!customerPhone) {
    return (
      <div className="text-center py-12">
        <p className="text-[13px] text-muted-foreground">Geen telefoonnummer bekend voor deze klant.</p>
        <p className="text-[11px] text-t3 mt-1">Voeg een telefoonnummer toe via "Bewerken".</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[500px] md:h-[600px]">
      {/* AI Agent Banner */}
      {aiActive && !aiDismissed && (
        <div className="px-3 py-2 bg-purple-50 dark:bg-purple-950/30 border-b border-purple-200 dark:border-purple-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Bot className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
            <span className="text-xs text-purple-800 dark:text-purple-200 font-medium">AI agent is actief voor dit gesprek</span>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] px-2 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50"
              onClick={handleAiHandOff}
            >
              <ArrowRight className="h-3 w-3 mr-1" />Neem over
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[10px] px-2 text-purple-600 dark:text-purple-400"
              onClick={() => navigate("/ai-conversations")}
            >
              <ExternalLink className="h-3 w-3 mr-1" />Bekijk
            </Button>
          </div>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1 bg-background/50 rounded-t-lg">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : sortedMessages.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-[12px]">
            Nog geen berichten. Stuur het eerste bericht!
          </div>
        ) : (
          <>
            {sortedMessages.map((msg, idx) => {
              const isOutgoing = msg.direction === "outgoing";
              const isIncoming = msg.direction === "incoming" || msg.direction === "inbound";
              const prevMsg = idx > 0 ? sortedMessages[idx - 1] : null;
              const showDate = !prevMsg || (
                new Date(msg.created_at ?? 0).toDateString() !== new Date(prevMsg.created_at ?? 0).toDateString()
              );
              const aiMsg = isAiMessage(msg);

              return (
                <div key={msg.id}>
                  {showDate && (
                    <div className="flex justify-center my-3">
                      <span className="text-[10px] font-bold text-muted-foreground bg-muted px-3 py-1 rounded-full">
                        {format(new Date(msg.created_at ?? new Date()), "EEEE d MMMM yyyy", { locale: nl })}
                      </span>
                    </div>
                  )}
                  <div className={`flex ${isOutgoing ? "justify-end" : "justify-start"} mb-0.5 group/msg`}>
                    <div
                      className={`relative max-w-[80%] md:max-w-[70%] rounded-xl px-3 py-2 ${
                        isOutgoing
                          ? aiMsg
                            ? "bg-purple-100 dark:bg-purple-900/40 text-purple-900 dark:text-purple-100 rounded-br-sm"
                            : "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-card border border-border text-foreground rounded-bl-sm"
                      }`}
                    >
                      {aiMsg && (
                        <div className="flex items-center gap-1 mb-1">
                          <Bot className="h-3 w-3" />
                          <span className="text-[9px] font-bold opacity-70">AI</span>
                        </div>
                      )}
                      <MediaRenderer msg={msg} />
                      {msg.content && (
                        <p className="text-[12.5px] md:text-[13px] whitespace-pre-wrap break-words">
                          {msg.content}
                        </p>
                      )}
                      {/* Interactive message rendering */}
                      {msg.type === "interactive" && msg.metadata?.interactive && (
                        <div className="mt-1.5 space-y-1">
                          {(msg.metadata.interactive as any)?.action?.buttons?.map((btn: any, i: number) => (
                            <div key={i} className="text-[11px] px-2 py-1 rounded bg-background/20 text-center font-medium">
                              {btn.reply?.title || btn.title || btn.text}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className={`flex items-center gap-1 mt-0.5 ${isOutgoing ? "justify-end" : ""}`}>
                        <span className={`text-[9px] ${isOutgoing ? (aiMsg ? "text-purple-600/60 dark:text-purple-300/60" : "text-primary-foreground/60") : "text-muted-foreground"}`}>
                          {msg.created_at ? format(new Date(msg.created_at), "HH:mm") : ""}
                        </span>
                        {isOutgoing && <StatusIcon status={msg.status} />}
                      </div>
                      {/* Emoji reaction button — only for incoming messages */}
                      {isIncoming && msg.wamid && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="absolute -bottom-2 right-1 opacity-0 group-hover/msg:opacity-100 transition-opacity h-5 w-5 rounded-full bg-card border border-border flex items-center justify-center text-[10px] shadow-sm hover:bg-muted">
                              <Smile className="h-3 w-3 text-muted-foreground" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-1.5 flex gap-1" side="top" align="end">
                            {QUICK_EMOJIS.map((emoji) => (
                              <button
                                key={emoji}
                                className="text-base hover:scale-125 transition-transform p-0.5"
                                onClick={() => {
                                  sendWhatsApp.mutate({
                                    to: customerPhone!,
                                    type: "reaction",
                                    reaction_message_id: msg.wamid,
                                    emoji,
                                    customer_id: customerId,
                                  });
                                }}
                              >
                                {emoji}
                              </button>
                            ))}
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-border bg-card rounded-b-lg p-3 space-y-2">
        {/* Mode toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode("text")}
            className={`text-[11px] font-bold px-2.5 py-1 rounded-full transition-colors ${
              mode === "text" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Tekst
          </button>
          <button
            onClick={() => setMode("template")}
            className={`text-[11px] font-bold px-2.5 py-1 rounded-full transition-colors ${
              mode === "template" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Template
          </button>
        </div>

        {mode === "text" ? (
          <div className="space-y-2">
            {pendingFile && (
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                {pendingPreview ? (
                  <img src={pendingPreview} alt="Preview" className="h-16 w-16 object-cover rounded-md" />
                ) : (
                  <div className="h-16 w-16 bg-muted rounded-md flex items-center justify-center">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium truncate">{pendingFile.name}</p>
                  <p className="text-[10px] text-muted-foreground">{(pendingFile.size / 1024).toFixed(0)} KB</p>
                </div>
                <Button variant="ghost" size="sm" onClick={clearPendingFile} className="h-7 w-7 p-0 shrink-0">
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="h-10 w-10 p-0 shrink-0"
                title="Bestand versturen"
              >
                <ImageIcon className="h-4 w-4" />
              </Button>
              <Textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={pendingFile ? "Bijschrift (optioneel)..." : "Typ een bericht..."}
                className="min-h-[40px] max-h-[120px] resize-none text-[13px] flex-1"
                rows={1}
              />
              <Button
                size="sm"
                onClick={handleSend}
                disabled={sending || (!message.trim() && !pendingFile)}
                className="h-10 w-10 p-0 shrink-0"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <SelectTrigger className="text-[12px]">
                <SelectValue placeholder="Kies een template..." />
              </SelectTrigger>
              <SelectContent>
                {approvedTemplates.map((t: any) => (
                  <SelectItem key={t.name} value={t.name} className="text-[12px]">
                    {t.name} ({t.language})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {activeTemplate && templateParams.keys.length > 0 && (
              <div className="space-y-1.5">
                {templateParams.keys.map((key) => (
                  <input
                    key={key}
                    value={templateVarMap[key] ?? ""}
                    onChange={(e) => {
                      setTemplateVarMap((prev) => ({ ...prev, [key]: e.target.value }));
                    }}
                    placeholder={templateParams.type === "named" ? key : `Variabele {{${key}}}`}
                    className="w-full px-3 py-2 bg-background border border-border rounded-sm text-[12px] placeholder:text-t3 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                ))}
              </div>
            )}

            {activeTemplate && (
              <div className="bg-muted/50 rounded-md p-2.5 text-[11.5px] text-secondary-foreground">
                <span className="font-bold text-[10px] text-muted-foreground block mb-1">Preview:</span>
                {(() => {
                  const bodyComp = activeTemplate.components?.find((c: any) => c.type === "BODY");
                  let text = bodyComp?.text ?? "";
                  templateParams.keys.forEach((key) => {
                    text = text.replace(`{{${key}}}`, templateVarMap[key] || `{{${key}}}`);
                  });
                  return text;
                })()}
              </div>
            )}

            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleSend}
                disabled={sending || !selectedTemplate}
                className="text-[12px]"
              >
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                Versturen
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
