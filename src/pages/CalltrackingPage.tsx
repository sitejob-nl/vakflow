import { useState, useMemo } from "react";
import { useCallRecords, useCallStats, type DateRange, type DirectionFilter, type StatusFilter, type EndReasonFilter } from "@/hooks/useCallRecords";
import { useCustomers } from "@/hooks/useCustomers";
import { useAuth } from "@/contexts/AuthContext";
import { useTodos, useCreateTodo } from "@/hooks/useTodos";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, format } from "date-fns";
import { nl } from "date-fns/locale";
import {
  Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Play, Pause, Link2, ListTodo, Loader2, Search, ArrowRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import ClickToDialButton from "@/components/shared/ClickToDialButton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";

// Helpers
const fmtDuration = (sec: number | null) => {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const getStatusBadge = (status: string | null, endReason: string | null) => {
  if (status === "ringing") {
    return { label: "Rinkelt", className: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30 animate-pulse" };
  }
  if (status === "transferred") {
    return { label: "Doorgeschakeld", className: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30" };
  }
  if (status === "voicemail") {
    return { label: "Voicemail", className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30" };
  }
  if (status === "ai_handled") {
    return { label: "AI afgehandeld", className: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30" };
  }
  if (status === "answered") {
    return { label: "Beantwoord", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" };
  }
  // missed / ended — differentiate by end_reason
  if (endReason === "busy") {
    return { label: "Bezet", className: "bg-destructive/15 text-destructive border-destructive/30" };
  }
  if (endReason === "cancelled") {
    return { label: "Opgehangen", className: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30" };
  }
  if (endReason === "abandon") {
    return { label: "Wachtrij verlaten", className: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30" };
  }
  if (endReason === "failed") {
    return { label: "Mislukt", className: "bg-destructive/15 text-destructive border-destructive/30" };
  }
  // default missed
  return { label: "Gemist", className: "bg-destructive/15 text-destructive border-destructive/30" };
};

const END_REASON_NL: Record<string, string> = {
  completed: "Afgerond",
  busy: "Bezet",
  "no-answer": "Niet opgenomen",
  failed: "Mislukt",
  cancelled: "Opgehangen",
  abandon: "Wachtrij verlaten",
};

type CallRecord = {
  id: string;
  started_at: string | null;
  direction: string;
  from_number: string | null;
  to_number: string | null;
  customer_id: string | null;
  status: string | null;
  duration_seconds: number | null;
  ai_summary: string | null;
  voys_summary: string | null;
  ai_action_items: any;
  transcription: string | null;
  recording_url: string | null;
  metadata: any;
  company_id: string;
  customers: { name: string } | null;
  caller_name: string | null;
  destination_number: string | null;
  answered_by_name: string | null;
  answered_by_account_number: number | null;
  end_reason: string | null;
  was_transferred: boolean | null;
  transferred_to: string | null;
  merged_call_id: string | null;
};

const CalltrackingPage = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { companyId } = useAuth();

  // Filters
  const [dateRange, setDateRange] = useState<DateRange>("today");
  const [direction, setDirection] = useState<DirectionFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [endReasonFilter, setEndReasonFilter] = useState<EndReasonFilter>("all");
  const [customFrom, setCustomFrom] = useState<Date>();
  const [customTo, setCustomTo] = useState<Date>();
  const [search, setSearch] = useState("");

  // Detail
  const [selected, setSelected] = useState<CallRecord | null>(null);

  // Link customer dialog
  const [linkCallId, setLinkCallId] = useState<string | null>(null);
  const [linkCustomerId, setLinkCustomerId] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);

  // Data
  const { data: records = [], isLoading } = useCallRecords(dateRange, direction, statusFilter, customFrom, customTo, endReasonFilter);
  const { data: stats } = useCallStats();
  const { data: customers } = useCustomers();
  const createTodo = useCreateTodo();

  // Search filter
  const filtered = useMemo(() => {
    if (!search.trim()) return records;
    const q = search.toLowerCase();
    return records.filter((r: any) =>
      r.customers?.name?.toLowerCase().includes(q) ||
      r.caller_name?.toLowerCase().includes(q) ||
      r.from_number?.includes(q) ||
      r.to_number?.includes(q) ||
      r.ai_summary?.toLowerCase().includes(q)
    );
  }, [records, search]);

  const handleLinkCustomer = async () => {
    if (!linkCallId || !linkCustomerId) return;
    setLinkBusy(true);
    const { error } = await supabase
      .from("call_records")
      .update({ customer_id: linkCustomerId })
      .eq("id", linkCallId);
    setLinkBusy(false);
    if (error) {
      toast({ title: "Fout", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Klant gekoppeld" });
      queryClient.invalidateQueries({ queryKey: ["call-records"] });
      setLinkCallId(null);
      setLinkCustomerId("");
      if (selected?.id === linkCallId) setSelected(null);
    }
  };

  const handleCreateTodo = async (record: CallRecord) => {
    const summary = record.ai_summary || record.voys_summary || "Terugbellen";
    try {
      await createTodo.mutateAsync({
        title: `Terugbellen: ${record.customers?.name || record.caller_name || record.from_number || "Onbekend"}`,
        description: summary,
        customer_id: record.customer_id || undefined,
      } as any);
      toast({ title: "Taak aangemaakt" });
    } catch {
      toast({ title: "Fout bij aanmaken taak", variant: "destructive" });
    }
  };

  const getNumber = (r: CallRecord) =>
    r.direction === "inbound" ? r.from_number : r.to_number;

  const getSummary = (r: CallRecord) => r.ai_summary || r.voys_summary || null;

  const actionItems = (r: CallRecord): string[] => {
    if (!r.ai_action_items) return [];
    if (Array.isArray(r.ai_action_items)) return r.ai_action_items.map(String);
    return [];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calltracking</h1>
          <p className="text-sm text-muted-foreground">Overzicht van alle telefoonactiviteit</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4 px-5">
            <p className="text-xs font-medium text-muted-foreground">Totaal (vandaag)</p>
            <p className="text-2xl font-bold mt-1">{stats?.total ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 px-5">
            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Beantwoord</p>
            <p className="text-2xl font-bold mt-1 text-emerald-700 dark:text-emerald-400">{stats?.answered ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 px-5">
            <p className="text-xs font-medium text-destructive">Gemist</p>
            <p className="text-2xl font-bold mt-1 text-destructive">{stats?.missed ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 px-5">
            <p className="text-xs font-medium text-purple-600 dark:text-purple-400 flex items-center gap-1">
              <ArrowRight className="h-3 w-3" /> Doorgeschakeld
            </p>
            <p className="text-2xl font-bold mt-1 text-purple-700 dark:text-purple-400">{stats?.transferred ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 px-5">
            <p className="text-xs font-medium text-muted-foreground">Gem. duur</p>
            <p className="text-2xl font-bold mt-1">{fmtDuration(stats?.avgDuration ?? 0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Vandaag</SelectItem>
            <SelectItem value="week">Deze week</SelectItem>
            <SelectItem value="month">Deze maand</SelectItem>
            <SelectItem value="custom">Aangepast</SelectItem>
          </SelectContent>
        </Select>

        {dateRange === "custom" && (
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  {customFrom ? format(customFrom, "dd-MM-yyyy") : "Van"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} />
              </PopoverContent>
            </Popover>
            <span className="text-muted-foreground text-sm">→</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  {customTo ? format(customTo, "dd-MM-yyyy") : "Tot"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customTo} onSelect={setCustomTo} />
              </PopoverContent>
            </Popover>
          </div>
        )}

        <Select value={direction} onValueChange={(v) => setDirection(v as DirectionFilter)}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle richtingen</SelectItem>
            <SelectItem value="inbound">Inkomend</SelectItem>
            <SelectItem value="outbound">Uitgaand</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle statussen</SelectItem>
            <SelectItem value="ringing">Rinkelt</SelectItem>
            <SelectItem value="answered">Beantwoord</SelectItem>
            <SelectItem value="missed">Gemist</SelectItem>
            <SelectItem value="ended">Beëindigd</SelectItem>
            <SelectItem value="transferred">Doorgeschakeld</SelectItem>
            <SelectItem value="voicemail">Voicemail</SelectItem>
            <SelectItem value="ai_handled">AI afgehandeld</SelectItem>
          </SelectContent>
        </Select>

        <Select value={endReasonFilter} onValueChange={(v) => setEndReasonFilter(v as EndReasonFilter)}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle redenen</SelectItem>
            <SelectItem value="completed">Afgerond</SelectItem>
            <SelectItem value="busy">Bezet</SelectItem>
            <SelectItem value="no-answer">Niet opgenomen</SelectItem>
            <SelectItem value="failed">Mislukt</SelectItem>
            <SelectItem value="cancelled">Opgehangen</SelectItem>
            <SelectItem value="abandon">Wachtrij verlaten</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Zoek op naam, nummer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-[220px]"
          />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">Tijdstip</TableHead>
                <TableHead className="w-[50px]">Richting</TableHead>
                <TableHead>Nummer</TableHead>
                <TableHead>Klant</TableHead>
                <TableHead className="w-[140px]">Status</TableHead>
                <TableHead>Opgenomen door</TableHead>
                <TableHead className="w-[80px]">Duur</TableHead>
                <TableHead>Samenvatting</TableHead>
                <TableHead>Actiepunten</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                    Geen gesprekken gevonden
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r: any) => {
                  const badge = getStatusBadge(r.status, r.end_reason);
                  const summary = getSummary(r);
                  const items = actionItems(r);
                  const number = getNumber(r);
                  return (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setSelected(r)}
                    >
                      <TableCell className="text-xs text-muted-foreground">
                        {r.started_at
                          ? formatDistanceToNow(new Date(r.started_at), { addSuffix: true, locale: nl })
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {r.direction === "inbound" ? (
                          <PhoneIncoming className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <PhoneOutgoing className="h-4 w-4 text-blue-600" />
                        )}
                      </TableCell>
                      <TableCell>
                        {r.caller_name ? (
                          <div>
                            <span className="text-sm font-medium">{r.caller_name}</span>
                            {number && <p className="text-xs text-muted-foreground font-mono">{number}</p>}
                          </div>
                        ) : (
                          <span className="font-mono text-sm">{number || "—"}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.customers?.name ? (
                          <span className="text-sm font-medium">{r.customers.name}</span>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-muted-foreground h-auto py-1 px-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLinkCallId(r.id);
                            }}
                          >
                            <Link2 className="h-3 w-3 mr-1" />
                            Koppelen
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={badge.className}>
                          {badge.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.was_transferred && r.transferred_to ? (
                          <span className="flex items-center gap-1 text-purple-700 dark:text-purple-400">
                            <ArrowRight className="h-3 w-3" />
                            {r.transferred_to}
                          </span>
                        ) : r.answered_by_name ? (
                          <span>{r.answered_by_name}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {fmtDuration(r.duration_seconds)}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        {summary ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-xs line-clamp-1">{summary.slice(0, 100)}</span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm">
                              <p className="text-xs whitespace-pre-wrap">{summary}</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {items.slice(0, 3).map((item, i) => (
                            <Badge key={i} variant="secondary" className="text-[10px] font-normal">
                              {item.length > 30 ? item.slice(0, 30) + "…" : item}
                            </Badge>
                          ))}
                          {items.length > 3 && (
                            <Badge variant="secondary" className="text-[10px]">+{items.length - 3}</Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail Sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  Gespreksdetail
                </SheetTitle>
              </SheetHeader>

              <div className="space-y-6 mt-6">
                {/* Gespreksdetails */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Gespreksdetails</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Beller</p>
                      <p className="font-medium">
                        {selected.caller_name || "Onbekend"}
                      </p>
                      {selected.from_number && (
                        <p className="text-xs text-muted-foreground font-mono">{selected.from_number}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Bestemming</p>
                      <p className="font-medium font-mono">{selected.destination_number || selected.to_number || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Opgenomen door</p>
                      <p className="font-medium">{selected.answered_by_name || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Duur</p>
                      <p className="font-medium">{fmtDuration(selected.duration_seconds)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Reden beëindiging</p>
                      <p className="font-medium">{selected.end_reason ? (END_REASON_NL[selected.end_reason] || selected.end_reason) : "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Doorgeschakeld</p>
                      <p className="font-medium">
                        {selected.was_transferred
                          ? `Ja → ${selected.transferred_to || "onbekend"}`
                          : "Nee"}
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Meta */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Tijdstip</p>
                    <p className="font-medium">
                      {selected.started_at
                        ? format(new Date(selected.started_at), "dd MMM yyyy HH:mm", { locale: nl })
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Richting</p>
                    <p className="font-medium flex items-center gap-1.5">
                      {selected.direction === "inbound" ? (
                        <><PhoneIncoming className="h-4 w-4 text-emerald-600" /> Inkomend</>
                      ) : (
                        <><PhoneOutgoing className="h-4 w-4 text-blue-600" /> Uitgaand</>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Klant</p>
                    <p className="font-medium">{selected.customers?.name || "Onbekend"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Status</p>
                    <Badge variant="outline" className={getStatusBadge(selected.status, selected.end_reason).className}>
                      {getStatusBadge(selected.status, selected.end_reason).label}
                    </Badge>
                  </div>
                </div>

                {/* Recording */}
                {selected.recording_url && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Opname</p>
                    <audio controls className="w-full" src={selected.recording_url}>
                      Je browser ondersteunt geen audio.
                    </audio>
                  </div>
                )}

                {/* Voys Summary */}
                {selected.voys_summary && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Voys samenvatting</p>
                    <p className="text-sm bg-muted/50 rounded-md p-3">{selected.voys_summary}</p>
                  </div>
                )}

                {/* AI Summary */}
                {selected.ai_summary && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">AI samenvatting</p>
                    <p className="text-sm bg-muted/50 rounded-md p-3">{selected.ai_summary}</p>
                  </div>
                )}

                {/* Action items */}
                {actionItems(selected).length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Actiepunten</p>
                    <div className="space-y-2">
                      {actionItems(selected).map((item, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <Checkbox disabled className="mt-0.5" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Transcription */}
                {selected.transcription && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Transcriptie</p>
                    <pre className="text-xs bg-muted/50 rounded-md p-3 whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">
                      {selected.transcription}
                    </pre>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  {!selected.customer_id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setLinkCallId(selected.id);
                        setSelected(null);
                      }}
                    >
                      <Link2 className="h-4 w-4 mr-1" />
                      Koppel aan klant
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCreateTodo(selected)}
                  >
                    <ListTodo className="h-4 w-4 mr-1" />
                    Maak taak
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Link Customer Dialog */}
      <Dialog open={!!linkCallId} onOpenChange={(o) => !o && setLinkCallId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Koppel aan klant</DialogTitle>
          </DialogHeader>
          <Select value={linkCustomerId} onValueChange={setLinkCustomerId}>
            <SelectTrigger><SelectValue placeholder="Selecteer klant" /></SelectTrigger>
            <SelectContent>
              {customers?.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkCallId(null)}>Annuleren</Button>
            <Button onClick={handleLinkCustomer} disabled={!linkCustomerId || linkBusy}>
              {linkBusy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Koppelen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalltrackingPage;
