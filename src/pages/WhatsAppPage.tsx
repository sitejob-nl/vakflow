import { useState, useMemo } from "react";
import { useWhatsAppMessages } from "@/hooks/useWhatsAppMessages";
import { useCustomers } from "@/hooks/useCustomers";
import { useWhatsAppStatus } from "@/hooks/useWhatsAppStatus";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import {
  MessageSquare, Search, Loader2, XCircle, CheckCheck, ArrowLeft, User,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import WhatsAppChat from "@/components/WhatsAppChat";
import ComposeWhatsAppDialog from "@/components/ComposeWhatsAppDialog";

const WhatsAppPage = () => {
  const { data: waMessages, isLoading } = useWhatsAppMessages();
  const { data: customers } = useCustomers();
  const { data: waStatus } = useWhatsAppStatus();

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);

  // Build conversations grouped by customer
  const conversations = useMemo(() => {
    if (!waMessages || !customers) return [];

    const map = new Map<string, {
      customerId: string;
      customerName: string;
      customerPhone: string | null;
      lastMessage: string;
      lastAt: string;
      unread: number;
      direction: string;
      status: string | null;
    }>();

    for (const msg of waMessages) {
      if (!msg.customer_id) continue;
      const existing = map.get(msg.customer_id);
      const msgTime = new Date(msg.created_at ?? 0).getTime();

      if (!existing || msgTime > new Date(existing.lastAt).getTime()) {
        const customer = customers.find((c) => c.id === msg.customer_id);
        map.set(msg.customer_id, {
          customerId: msg.customer_id,
          customerName: customer?.name ?? "Onbekend",
          customerPhone: customer?.phone ?? null,
          lastMessage: msg.content ?? (msg.type !== "text" ? `📎 ${msg.type}` : ""),
          lastAt: msg.created_at ?? new Date().toISOString(),
          unread: (existing?.unread ?? 0) + (
            (msg.direction === "incoming" || msg.direction === "inbound") && msg.status !== "read" ? 1 : 0
          ),
          direction: msg.direction,
          status: msg.status,
        });
      } else {
        // Count unread
        if ((msg.direction === "incoming" || msg.direction === "inbound") && msg.status !== "read") {
          existing.unread += 1;
        }
      }
    }

    return Array.from(map.values())
      .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
  }, [waMessages, customers]);

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter((c) =>
      c.customerName.toLowerCase().includes(q) ||
      c.lastMessage.toLowerCase().includes(q)
    );
  }, [conversations, searchQuery]);

  const selectedCustomer = customers?.find((c) => c.id === selectedCustomerId);
  const selectedConvo = conversations.find((c) => c.customerId === selectedCustomerId);

  if (!waStatus?.connected) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <XCircle className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-[14px] font-semibold text-foreground">WhatsApp is niet gekoppeld</p>
          <p className="text-[12px] text-muted-foreground mt-1">Ga naar Instellingen → WhatsApp om te koppelen.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-5 w-5 text-accent" />
          <h1 className="text-lg font-bold">WhatsApp</h1>
          {waStatus?.phone && (
            <span className="text-[11px] text-muted-foreground">{waStatus.phone}</span>
          )}
        </div>
        <Button size="sm" onClick={() => setComposeOpen(true)}>
          <MessageSquare className="h-3.5 w-3.5 mr-1" /> Nieuw bericht
        </Button>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-0 bg-card border border-border rounded-lg shadow-card overflow-hidden min-h-[600px]">
        {/* Contact list - hidden on mobile when chat selected */}
        <div className={`border-r border-border flex flex-col ${selectedCustomerId ? "hidden lg:flex" : "flex"}`}>
          {/* Search */}
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Zoek contacten..."
                className="h-9 pl-8 text-[12px]"
              />
            </div>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : filteredConversations.length === 0 ? (
              <div className="text-center py-10 text-[12px] text-muted-foreground">
                {searchQuery ? "Geen resultaten" : "Nog geen gesprekken"}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredConversations.map((convo) => {
                  const isSelected = selectedCustomerId === convo.customerId;
                  const lastDate = new Date(convo.lastAt);
                  const isToday = lastDate.toDateString() === new Date().toDateString();
                  const timeStr = isToday
                    ? format(lastDate, "HH:mm")
                    : format(lastDate, "dd MMM", { locale: nl });

                  return (
                    <button
                      key={convo.customerId}
                      onClick={() => setSelectedCustomerId(convo.customerId)}
                      className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                        isSelected ? "bg-primary-muted" : "hover:bg-muted/40"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                        <User className="h-5 w-5 text-accent" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] font-bold truncate">{convo.customerName}</span>
                          <span className="text-[10px] text-muted-foreground font-mono shrink-0 ml-2">{timeStr}</span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <p className="text-[11px] text-muted-foreground truncate flex-1">
                            {convo.direction === "outgoing" && (
                              <CheckCheck className="inline h-3 w-3 mr-1 text-muted-foreground" />
                            )}
                            {convo.lastMessage}
                          </p>
                          {convo.unread > 0 && (
                            <span className="bg-accent text-accent-foreground text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 ml-2">
                              {convo.unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className={`flex flex-col ${!selectedCustomerId ? "hidden lg:flex" : "flex"}`}>
          {selectedCustomerId && selectedCustomer ? (
            <>
              {/* Chat header */}
              <div className="px-4 py-3 border-b border-border flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden h-8 w-8"
                  onClick={() => setSelectedCustomerId(null)}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                  <User className="h-4.5 w-4.5 text-accent" />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold truncate">{selectedCustomer.name}</p>
                  {selectedCustomer.phone && (
                    <p className="text-[11px] text-muted-foreground">{selectedCustomer.phone}</p>
                  )}
                </div>
              </div>
              {/* Chat component */}
              <div className="flex-1 min-h-0">
                <WhatsAppChat
                  customerId={selectedCustomerId}
                  customerPhone={selectedCustomer.phone}
                  customerName={selectedCustomer.name}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-[14px] text-muted-foreground font-semibold">Selecteer een gesprek</p>
                <p className="text-[12px] text-muted-foreground mt-1">
                  Kies een contact uit de lijst om het gesprek te openen
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <ComposeWhatsAppDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        customerPhone=""
        customerId={undefined}
      />
    </div>
  );
};

export default WhatsAppPage;
