import { useState, useMemo, useRef, useCallback } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { useTradeVehicles, useTradeVehicleStats, useHexonListings, PIPELINE_STATUSES, STATUS_LABELS, type TradeVehicle } from "@/hooks/useTradeVehicles";
import { useRdwLookup } from "@/hooks/useVehicles";
import { TradeVehicleDialog } from "@/components/TradeVehicleDialog";
import TradeVehicleDetailSheet from "@/components/TradeVehicleDetailSheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useSignedUrl } from "@/hooks/useSignedUrl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, Search, Loader2, RefreshCw, LayoutGrid, TableIcon, Car, TrendingUp, DollarSign, ImageIcon, AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

type ViewMode = "kanban" | "table";
type SortField = "created_at" | "brand" | "license_plate" | "year" | "mileage" | "purchase_price" | "target_sell_price" | "status";

const statusBadgeClass: Record<string, string> = {
  intake: "bg-slate-500/15 text-slate-700 border-slate-500/30",
  getaxeerd: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  gekocht: "bg-indigo-500/15 text-indigo-700 border-indigo-500/30",
  betaald: "bg-violet-500/15 text-violet-700 border-violet-500/30",
  transport: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  binnen: "bg-cyan-500/15 text-cyan-700 border-cyan-500/30",
  in_bewerking: "bg-orange-500/15 text-orange-700 border-orange-500/30",
  foto_klaar: "bg-teal-500/15 text-teal-700 border-teal-500/30",
  online: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  verkocht: "bg-green-600/15 text-green-700 border-green-600/30",
  afgeleverd: "bg-green-700/15 text-green-800 border-green-700/30",
  gearchiveerd: "bg-gray-500/15 text-gray-600 border-gray-500/30",
};

const HexonDot = ({ listings }: { listings: any[] }) => {
  if (!listings || listings.length === 0) return <span className="h-2 w-2 rounded-full bg-gray-300 inline-block" title="Niet gepubliceerd" />;
  const hasError = listings.some(l => l.status === "error");
  const hasPending = listings.some(l => l.status === "pending" || l.status === "processing");
  const allOnline = listings.every(l => l.status === "online" || l.status === "published");
  if (hasError) return <span className="h-2 w-2 rounded-full bg-destructive inline-block" title="Hexon fout" />;
  if (hasPending) return <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" title="Hexon pending" />;
  if (allOnline) return <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" title="Online" />;
  return <span className="h-2 w-2 rounded-full bg-gray-400 inline-block" />;
};

const PortalStatusBadges = ({ listings }: { listings: any[] }) => {
  if (!listings || listings.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {listings.map(l => {
        const dotColor = l.status === "online" || l.status === "published" ? "bg-emerald-500"
          : l.status === "error" ? "bg-destructive"
          : l.status === "pending" || l.status === "processing" ? "bg-amber-500"
          : "bg-gray-400";
        const hasWarning = l.notifications?.length > 0 || l.warnings;
        return (
          <Tooltip key={l.id}>
            <TooltipTrigger asChild>
              {l.deeplink_url ? (
                <a href={l.deeplink_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted/60 rounded px-1.5 py-0.5 hover:bg-muted transition-colors" onClick={e => e.stopPropagation()}>
                  <span className={`h-1.5 w-1.5 rounded-full ${dotColor} inline-block`} />
                  {l.portal_name || l.site_code}
                  {hasWarning && <AlertTriangle className="h-2.5 w-2.5 text-amber-500" />}
                  {l.status === "error" && <AlertTriangle className="h-2.5 w-2.5 text-destructive" />}
                </a>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted/60 rounded px-1.5 py-0.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${dotColor} inline-block`} />
                  {l.portal_name || l.site_code}
                  {hasWarning && <AlertTriangle className="h-2.5 w-2.5 text-amber-500" />}
                </span>
              )}
            </TooltipTrigger>
            <TooltipContent><p>{l.status_message || l.status || "Onbekend"}</p></TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
};

const VehiclePhoto = () => {
  return (
    <div className="h-full w-full bg-muted flex items-center justify-center">
      <ImageIcon className="h-4 w-4 text-muted-foreground" />
    </div>
  );
};

const KanbanCard = ({ vehicle, hexonListings, onClick }: { vehicle: TradeVehicle; hexonListings: any[]; onClick: () => void }) => {
  const margin = vehicle.target_sell_price - vehicle.purchase_price - vehicle.estimated_repair_cost;
  const vehicleListings = hexonListings.filter(l => l.trade_vehicle_id === vehicle.id);

  return (
    <div
      onClick={onClick}
      className="bg-card border rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow space-y-2"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold font-mono">{vehicle.license_plate || "—"}</span>
        <HexonDot listings={vehicleListings} />
      </div>
      <p className="text-sm font-semibold truncate">{vehicle.brand} {vehicle.model}</p>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>€{vehicle.purchase_price.toLocaleString("nl-NL")}</span>
        <span>→ €{vehicle.target_sell_price.toLocaleString("nl-NL")}</span>
      </div>
      <div className={`text-xs font-bold ${margin >= 0 ? "text-emerald-600" : "text-destructive"}`}>
        Marge: €{margin.toLocaleString("nl-NL")}
      </div>
    </div>
  );
};

const TradeVehiclesPage = () => {
  const { data: vehicles, isLoading, upsert, updateStatus } = useTradeVehicles();
  const stats = useTradeVehicleStats();
  const { data: hexonListings = [] } = useHexonListings();
  const rdwLookup = useRdwLookup();
  const { companyId } = useAuth();
  const { toast } = useToast();

  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [detailVehicle, setDetailVehicle] = useState<TradeVehicle | null>(null);
  const [search, setSearch] = useState("");
  const [rdwPlate, setRdwPlate] = useState("");
  const [rdwLoading, setRdwLoading] = useState(false);
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortAsc, setSortAsc] = useState(false);

  // Hexon publish confirm dialog
  const [publishConfirm, setPublishConfirm] = useState<{ vehicleId: string; status: string } | null>(null);

  const filtered = useMemo(() => {
    if (!vehicles) return [];
    if (!search.trim()) return vehicles;
    const q = search.toLowerCase();
    return vehicles.filter(v =>
      [v.brand, v.model, v.license_plate, v.hexon_stocknumber].some(
        f => f?.toLowerCase().includes(q)
      )
    );
  }, [vehicles, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let va: any = (a as any)[sortField];
      let vb: any = (b as any)[sortField];
      if (typeof va === "string") va = va.toLowerCase();
      if (typeof vb === "string") vb = vb.toLowerCase();
      if (va == null) return 1;
      if (vb == null) return -1;
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortField, sortAsc]);

  const vehiclesByStatus = useMemo(() => {
    const map: Record<string, TradeVehicle[]> = {};
    PIPELINE_STATUSES.forEach(s => { map[s.key] = []; });
    filtered.forEach(v => {
      if (map[v.status]) map[v.status].push(v);
      else if (map.intake) map.intake.push(v); // fallback
    });
    return map;
  }, [filtered]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const newStatus = result.destination.droppableId;
    const vehicleId = result.draggableId;
    const oldStatus = result.source.droppableId;
    if (newStatus === oldStatus) return;

    // Publish confirmation for foto_klaar/online
    if (newStatus === "foto_klaar" || newStatus === "online") {
      setPublishConfirm({ vehicleId, status: newStatus });
      return;
    }

    // Auto-unpublish for verkocht/gearchiveerd
    if (newStatus === "verkocht" || newStatus === "gearchiveerd") {
      updateStatus.mutate({ id: vehicleId, status: newStatus });
      supabase.functions.invoke("hexon-sync" as any, {
        body: { action: "unpublish", trade_vehicle_id: vehicleId },
      }).catch(() => {});
      return;
    }

    updateStatus.mutate({ id: vehicleId, status: newStatus });
  };

  const handlePublishConfirm = () => {
    if (!publishConfirm) return;
    updateStatus.mutate({ id: publishConfirm.vehicleId, status: publishConfirm.status });
    supabase.functions.invoke("hexon-sync" as any, {
      body: { action: "publish", trade_vehicle_id: publishConfirm.vehicleId },
    }).catch(() => {});
    setPublishConfirm(null);
  };

  const handleSave = (data: any) => {
    upsert.mutate(data);
  };

  const openNew = () => { setEditing(null); setDialogOpen(true); };

  const handleRdwIntake = async () => {
    if (!rdwPlate.trim()) return;
    setRdwLoading(true);
    try {
      const result = await rdwLookup.mutateAsync(rdwPlate);
      if (result.found) {
        const prefill = {
          license_plate: rdwPlate.replace(/[\s-]/g, "").toUpperCase(),
          brand: result.brand ?? "",
          model: result.model ?? "",
          year: result.build_year ?? new Date().getFullYear(),
          fuel_type: result.fuel_type?.toLowerCase() ?? "benzine",
          color: result.color ?? "",
        };
        setEditing(prefill);
        setDialogOpen(true);
        setRdwPlate("");
      } else {
        toast({ title: "Kenteken niet gevonden bij RDW", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "RDW fout", description: err.message, variant: "destructive" });
    }
    setRdwLoading(false);
  };

  const margin = (v: TradeVehicle) => v.target_sell_price - v.purchase_price - v.estimated_repair_cost;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Voertuig Pipeline</h1>
          <p className="text-muted-foreground text-sm">Beheer voertuigen van intake tot aflevering</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border rounded-md overflow-hidden">
            <Button
              variant={viewMode === "kanban" ? "default" : "ghost"}
              size="sm"
              className="rounded-none"
              onClick={() => setViewMode("kanban")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="sm"
              className="rounded-none"
              onClick={() => setViewMode("table")}
            >
              <TableIcon className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" /> Nieuw voertuig
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2">
              <Car className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">In pipeline</p>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.inPipeline}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-emerald-600">Online</p>
            <p className="text-2xl font-bold mt-1 text-emerald-700">{stats.online}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Omzet</p>
            </div>
            <p className="text-2xl font-bold mt-1">€{stats.totalRevenue.toLocaleString("nl-NL")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Marge</p>
            </div>
            <p className={`text-2xl font-bold mt-1 ${stats.totalMargin >= 0 ? "text-emerald-600" : "text-destructive"}`}>
              €{stats.totalMargin.toLocaleString("nl-NL")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Zoek op kenteken, merk, model..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Input
            className="w-[140px] font-mono uppercase"
            placeholder="Kenteken"
            value={rdwPlate}
            onChange={(e) => setRdwPlate(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRdwIntake()}
          />
          <Button variant="outline" size="sm" onClick={handleRdwIntake} disabled={rdwLoading || !rdwPlate.trim()}>
            {rdwLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-1">RDW intake</span>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : viewMode === "kanban" ? (
        /* ====== KANBAN VIEW ====== */
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: 400 }}>
            {PIPELINE_STATUSES.map((col) => (
              <Droppable droppableId={col.key} key={col.key}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-shrink-0 w-[220px] rounded-lg border p-2 space-y-2 transition-colors ${
                      snapshot.isDraggingOver ? "bg-accent/50 border-accent" : "bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 px-1 py-1">
                      <div className={`h-2 w-2 rounded-full ${col.color}`} />
                      <span className="text-xs font-bold uppercase tracking-wide">{col.label}</span>
                      <Badge variant="secondary" className="text-[10px] ml-auto h-5 px-1.5">
                        {vehiclesByStatus[col.key]?.length || 0}
                      </Badge>
                    </div>
                    {(vehiclesByStatus[col.key] || []).map((v, index) => (
                      <Draggable key={v.id} draggableId={v.id} index={index}>
                        {(dragProvided) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            {...dragProvided.dragHandleProps}
                          >
                            <KanbanCard
                              vehicle={v}
                              hexonListings={hexonListings}
                              onClick={() => setDetailVehicle(v)}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            ))}
          </div>
        </DragDropContext>
      ) : (
        /* ====== TABLE VIEW ====== */
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort("license_plate")}>Kenteken</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort("brand")}>Merk</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort("year")}>Bouwjaar</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort("mileage")}>Km-stand</TableHead>
                  <TableHead>Brandstof</TableHead>
                  <TableHead>Kleur</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort("purchase_price")}>Inkoop</TableHead>
                  <TableHead>Reparatie</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort("target_sell_price")}>Verkoopprijs</TableHead>
                  <TableHead>Marge</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort("status")}>Status</TableHead>
                  <TableHead>Bron</TableHead>
                  <TableHead className="w-[40px]">Hexon</TableHead>
                  <TableHead>Portaalstatus</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort("created_at")}>Aangemaakt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={16} className="text-center py-12 text-muted-foreground">
                      Geen voertuigen gevonden
                    </TableCell>
                  </TableRow>
                ) : sorted.map(v => {
                  const m = margin(v);
                  const vListings = hexonListings.filter(l => l.trade_vehicle_id === v.id);
                  return (
                    <TableRow
                      key={v.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setDetailVehicle(v)}
                    >
                      <TableCell>
                        <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                          <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      </TableCell>
                      <TableCell className="font-mono font-medium text-xs">{v.license_plate || "—"}</TableCell>
                      <TableCell className="font-medium text-sm">{v.brand || "—"}</TableCell>
                      <TableCell className="text-sm">{v.model || "—"}</TableCell>
                      <TableCell className="text-sm">{v.year || "—"}</TableCell>
                      <TableCell className="text-sm">{v.mileage ? `${v.mileage.toLocaleString("nl-NL")} km` : "—"}</TableCell>
                      <TableCell className="text-sm capitalize">{v.fuel_type || "—"}</TableCell>
                      <TableCell className="text-sm">{v.color || "—"}</TableCell>
                      <TableCell className="text-sm">€{v.purchase_price.toLocaleString("nl-NL")}</TableCell>
                      <TableCell className="text-sm">€{v.estimated_repair_cost.toLocaleString("nl-NL")}</TableCell>
                      <TableCell className="text-sm">€{v.target_sell_price.toLocaleString("nl-NL")}</TableCell>
                      <TableCell>
                        <span className={`text-sm font-semibold ${m >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                          €{m.toLocaleString("nl-NL")}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${statusBadgeClass[v.status] || ""}`}>
                          {STATUS_LABELS[v.status] || v.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{v.source || "—"}</TableCell>
                      <TableCell><HexonDot listings={vListings} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(v.created_at), "dd MMM yy", { locale: nl })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Publish confirmation dialog */}
      <AlertDialog open={!!publishConfirm} onOpenChange={(o) => !o && setPublishConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publiceren op portalen?</AlertDialogTitle>
            <AlertDialogDescription>
              Wil je dit voertuig publiceren op de aangesloten portalen via Hexon?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              // Still update status but skip publish
              if (publishConfirm) updateStatus.mutate({ id: publishConfirm.vehicleId, status: publishConfirm.status });
              setPublishConfirm(null);
            }}>
              Alleen status wijzigen
            </AlertDialogCancel>
            <AlertDialogAction onClick={handlePublishConfirm}>
              Publiceren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Detail Sheet */}
      <TradeVehicleDetailSheet
        vehicle={detailVehicle}
        onClose={() => setDetailVehicle(null)}
        onSave={handleSave}
      />

      {/* New/Edit Dialog */}
      <TradeVehicleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        vehicle={editing}
        onSave={handleSave}
      />
    </div>
  );
};

export default TradeVehiclesPage;
