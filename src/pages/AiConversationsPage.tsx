import { useState, useMemo } from "react";
import { Bot, MessageSquare, Phone, Globe, ArrowRight, RotateCcw, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAiConversations, type AiConversation } from "@/hooks/useAiConversations";
import { useNavigation } from "@/hooks/useNavigation";
import { format, formatDistanceToNow, isToday, differenceInMinutes } from "date-fns";
import { nl } from "date-fns/locale";

const triggerBadge = (t: string) => {
  switch (t) {
    case "whatsapp": case "incoming": return <Badge className="bg-blue-500/15 text-blue-700 border-blue-200">WhatsApp</Badge>;
    case "missed_call": return <Badge variant="destructive">Gemiste oproep</Badge>;
    case "portal": return <Badge className="bg-purple-500/15 text-purple-700 border-purple-200">Portaal</Badge>;
    default: return <Badge variant="secondary">{t}</Badge>;
  }
};

const statusBadge = (s: string) => {
  switch (s) {
    case "active": return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-200">Actief</Badge>;
    case "completed": return <Badge variant="secondary">Afgerond</Badge>;
    case "escalated": return <Badge variant="destructive">Geëscaleerd</Badge>;
    case "expired": return <Badge variant="outline">Verlopen</Badge>;
    case "handed_off": return <Badge className="bg-amber-500/15 text-amber-700 border-amber-200">Overgedragen</Badge>;
    default: return <Badge variant="secondary">{s}</Badge>;
  }
};

const routeBadge = (r: string | null) => {
  if (!r) return null;
  switch (r) {
    case "werkplaats": return <Badge className="bg-orange-500/15 text-orange-700 border-orange-200">Werkplaats</Badge>;
    case "verkoop": return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-200">Verkoop</Badge>;
    case "admin": return <Badge className="bg-blue-500/15 text-blue-700 border-blue-200">Admin</Badge>;
    default: return <Badge variant="outline">{r}</Badge>;
  }
};

const formatDuration = (start: string | null, end: string | null) => {
  if (!start || !end) return "-";
  const mins = differenceInMinutes(new Date(end), new Date(start));
  if (mins < 1) return "<1 min";
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

export default function AiConversationsPage() {
  const { conversations, isLoading, maxTurns, updateStatus } = useAiConversations();
  const { navigate } = useNavigation();
  const [selectedConv, setSelectedConv] = useState<AiConversation | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const active = useMemo(() => conversations.filter(c => c.status === "active"), [conversations]);
  const history = useMemo(() => {
    const nonActive = conversations.filter(c => c.status !== "active");
    if (statusFilter === "all") return nonActive;
    return nonActive.filter(c => c.status === statusFilter);
  }, [conversations, statusFilter]);

  const stats = useMemo(() => {
    const today = conversations.filter(c => c.updated_at && isToday(new Date(c.updated_at)));
    const completed = today.filter(c => c.status === "completed");
    const escalated = today.filter(c => c.status === "escalated");
    const avgSteps = completed.length
      ? Math.round(completed.reduce((s, c) => s + (c.current_step ?? 0), 0) / completed.length * 10) / 10
      : 0;
    return { active: active.length, completed: completed.length, escalated: escalated.length, avgSteps };
  }, [conversations, active]);

  const handleHandOff = (conv: AiConversation) => {
    updateStatus.mutate({ id: conv.id, status: "handed_off" });
    navigate("whatsapp");
  };

  const messages = useMemo(() => {
    if (!selectedConv?.messages) return [];
    return Array.isArray(selectedConv.messages) ? selectedConv.messages : [];
  }, [selectedConv]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Bot className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">AI Conversaties</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Actief</p>
          <p className="text-2xl font-bold">{stats.active}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Afgerond vandaag</p>
          <p className="text-2xl font-bold">{stats.completed}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Geëscaleerd vandaag</p>
          <p className="text-2xl font-bold text-destructive">{stats.escalated}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Gem. stappen</p>
          <p className="text-2xl font-bold">{stats.avgSteps}</p>
        </CardContent></Card>
      </div>

      {/* Active conversations */}
      {active.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Actieve conversaties</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {active.map(conv => {
              const lastMsg = Array.isArray(conv.messages) && conv.messages.length > 0
                ? conv.messages[conv.messages.length - 1]
                : null;
              return (
                <Card key={conv.id} className="border-emerald-200 dark:border-emerald-800">
                  <CardContent className="pt-4 pb-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm truncate">
                        {conv.customer?.name || conv.phone_number}
                      </span>
                      {triggerBadge(conv.trigger_type)}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Stap {conv.current_step ?? 0}/{maxTurns}</span>
                      <span>·</span>
                      <span>{conv.created_at ? formatDistanceToNow(new Date(conv.created_at), { locale: nl, addSuffix: true }) : "-"}</span>
                    </div>
                    {lastMsg && (
                      <p className="text-xs bg-muted rounded px-2 py-1 truncate">
                        {lastMsg.role === "assistant" ? "AI: " : ""}{lastMsg.content || lastMsg.text || JSON.stringify(lastMsg).slice(0, 80)}
                      </p>
                    )}
                    {conv.collected_data && Object.keys(conv.collected_data).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(conv.collected_data).slice(0, 4).map(([k, v]) => (
                          <Badge key={k} variant="outline" className="text-[10px]">{k}: {String(v)}</Badge>
                        ))}
                      </div>
                    )}
                    {conv.routed_to && <div>{routeBadge(conv.routed_to)}</div>}
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="default" className="text-xs h-7" onClick={() => handleHandOff(conv)}>
                        <ArrowRight className="h-3 w-3 mr-1" />Neem over
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setSelectedConv(conv)}>
                        Bekijk
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* History */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Geschiedenis</h2>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle statussen</SelectItem>
              <SelectItem value="completed">Afgerond</SelectItem>
              <SelectItem value="escalated">Geëscaleerd</SelectItem>
              <SelectItem value="expired">Verlopen</SelectItem>
              <SelectItem value="handed_off">Overgedragen</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Geen conversaties gevonden.</p>
        ) : (
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Telefoon</TableHead>
                  <TableHead>Klant</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead className="text-right">Stappen</TableHead>
                  <TableHead className="text-right">Duur</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map(conv => (
                  <TableRow key={conv.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedConv(conv)}>
                    <TableCell className="text-xs">{conv.created_at ? format(new Date(conv.created_at), "dd MMM HH:mm", { locale: nl }) : "-"}</TableCell>
                    <TableCell className="text-xs font-mono">{conv.phone_number}</TableCell>
                    <TableCell className="text-xs">{conv.customer?.name || "-"}</TableCell>
                    <TableCell>{triggerBadge(conv.trigger_type)}</TableCell>
                    <TableCell>{statusBadge(conv.status)}</TableCell>
                    <TableCell>{routeBadge(conv.routed_to)}</TableCell>
                    <TableCell className="text-right text-xs">{conv.current_step ?? 0}</TableCell>
                    <TableCell className="text-right text-xs">{formatDuration(conv.created_at, conv.updated_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Detail Sheet */}
      <Sheet open={!!selectedConv} onOpenChange={o => !o && setSelectedConv(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selectedConv && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  {selectedConv.customer?.name || selectedConv.phone_number}
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <div className="flex flex-wrap gap-2">
                  {triggerBadge(selectedConv.trigger_type)}
                  {statusBadge(selectedConv.status)}
                  {routeBadge(selectedConv.routed_to)}
                </div>

                {/* Chat messages */}
                <div className="space-y-2 max-h-[400px] overflow-y-auto border rounded-md p-3 bg-muted/30">
                  {messages.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Geen berichten</p>}
                  {messages.map((m: any, i: number) => {
                    const isAi = m.role === "assistant" || m.role === "ai";
                    return (
                      <div key={i} className={`flex ${isAi ? "justify-end" : "justify-start"}`}>
                        <div className={`rounded-lg px-3 py-2 max-w-[80%] text-xs ${isAi ? "bg-primary text-primary-foreground" : "bg-background border"}`}>
                          {m.content || m.text || JSON.stringify(m)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Collected data */}
                {selectedConv.collected_data && Object.keys(selectedConv.collected_data).length > 0 && (
                  <div>
                    <p className="text-xs font-medium mb-1">Verzamelde data</p>
                    <div className="grid grid-cols-2 gap-1">
                      {Object.entries(selectedConv.collected_data).map(([k, v]) => (
                        <div key={k} className="text-xs bg-muted rounded px-2 py-1">
                          <span className="text-muted-foreground">{k}:</span> {String(v)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedConv.escalation_reason && (
                  <div className="text-xs bg-destructive/10 rounded p-2 text-destructive">
                    <span className="font-medium">Escalatie:</span> {selectedConv.escalation_reason}
                  </div>
                )}

                {/* Links */}
                <div className="flex flex-wrap gap-2">
                  {selectedConv.lead_id && (
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => { setSelectedConv(null); navigate("leads"); }}>
                      <ExternalLink className="h-3 w-3 mr-1" />Lead bekijken
                    </Button>
                  )}
                  {selectedConv.call_record_id && (
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => { setSelectedConv(null); navigate("calltracking"); }}>
                      <Phone className="h-3 w-3 mr-1" />Gesprek bekijken
                    </Button>
                  )}
                </div>

                {/* Actions */}
                {selectedConv.status !== "active" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      updateStatus.mutate({ id: selectedConv.id, status: "active" });
                      setSelectedConv({ ...selectedConv, status: "active" });
                    }}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />Heropen conversatie
                  </Button>
                )}
                {selectedConv.status === "active" && (
                  <Button size="sm" onClick={() => { handleHandOff(selectedConv); setSelectedConv(null); }}>
                    <ArrowRight className="h-3 w-3 mr-1" />Neem over
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
