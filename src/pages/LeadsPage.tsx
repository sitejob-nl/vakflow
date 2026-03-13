import { useState, useMemo, useCallback, useEffect } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { useLeads, useLeadStatuses, useUpdateLead, useDeleteLead, useUpsertLeadStatus, useReorderLeadStatuses, type Lead, type LeadStatus } from "@/hooks/useLeads";
import { useAuth } from "@/contexts/AuthContext";
import LeadDialog from "@/components/LeadDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, Trash2, Pencil, User, Mail, Phone, Building2, Loader2, GripVertical } from "lucide-react";
import ClickToDialButton from "@/components/shared/ClickToDialButton";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const DEFAULT_STATUSES = [
  { name: "Nieuw", color: "#3b82f6", sort_order: 0 },
  { name: "Gecontacteerd", color: "#f59e0b", sort_order: 1 },
  { name: "Offerte", color: "#8b5cf6", sort_order: 2 },
  { name: "Gewonnen", color: "#10b981", sort_order: 3 },
  { name: "Verloren", color: "#ef4444", sort_order: 4 },
];

const LeadsPage = () => {
  const { companyId } = useAuth();
  const { toast } = useToast();
  const { data: statuses, isLoading: statusesLoading } = useLeadStatuses();
  const { data: leads, isLoading: leadsLoading } = useLeads();
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  const upsertStatus = useUpsertLeadStatus();
  const reorderStatuses = useReorderLeadStatuses();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [defaultStatusId, setDefaultStatusId] = useState<string>("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Seed default statuses if none exist
  useEffect(() => {
    if (statusesLoading || initialized) return;
    setInitialized(true);
    if (statuses && statuses.length === 0 && companyId) {
      (async () => {
        for (const s of DEFAULT_STATUSES) {
          await upsertStatus.mutateAsync(s as any);
        }
      })();
    }
  }, [statuses, statusesLoading, companyId, initialized]);

  const filteredLeads = useMemo(() => {
    if (!leads) return [];
    if (!search) return leads;
    const q = search.toLowerCase();
    return leads.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        (l.email ?? "").toLowerCase().includes(q) ||
        (l.company_name ?? "").toLowerCase().includes(q) ||
        (l.phone ?? "").toLowerCase().includes(q)
    );
  }, [leads, search]);

  const leadsByStatus = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    for (const s of statuses ?? []) {
      map[s.id] = [];
    }
    for (const l of filteredLeads) {
      if (map[l.status_id]) {
        map[l.status_id].push(l);
      }
    }
    // Sort within columns by sort_order
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.sort_order - b.sort_order);
    }
    return map;
  }, [statuses, filteredLeads]);

  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      if (!result.destination) return;
      const { source, destination, draggableId } = result;

      // Reordering statuses (columns)
      if (result.type === "COLUMN") {
        if (!statuses) return;
        const reordered = [...statuses];
        const [moved] = reordered.splice(source.index, 1);
        reordered.splice(destination.index, 0, moved);
        const updates = reordered.map((s, i) => ({ id: s.id, sort_order: i }));
        await reorderStatuses.mutateAsync(updates);
        return;
      }

      // Moving leads
      const newStatusId = destination.droppableId;
      const newSortOrder = destination.index;

      try {
        await updateLead.mutateAsync({
          id: draggableId,
          status_id: newStatusId,
          sort_order: newSortOrder,
        });
      } catch (err: any) {
        toast({ title: "Fout", description: err.message, variant: "destructive" });
      }
    },
    [statuses, updateLead, reorderStatuses, toast]
  );

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteLead.mutateAsync(deleteId);
      toast({ title: "Lead verwijderd" });
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
    setDeleteId(null);
  };

  const isLoading = statusesLoading || leadsLoading;

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 h-full">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold">Leads</h1>
        <Button
          size="sm"
          onClick={() => {
            setEditLead(null);
            setDefaultStatusId(statuses?.[0]?.id || "");
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" /> Nieuwe lead
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Zoek leads..."
          className="pl-9"
        />
      </div>

      {/* Kanban board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 min-h-[60vh]">
          {(statuses ?? []).map((status, colIndex) => (
            <div key={status.id} className="flex-shrink-0 w-[300px]">
              {/* Column header */}
              <div
                className="flex items-center justify-between px-3 py-2.5 rounded-t-lg border border-b-0 border-border"
                style={{ backgroundColor: status.color + "18" }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: status.color }} />
                  <span className="text-sm font-bold">{status.name}</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {leadsByStatus[status.id]?.length ?? 0}
                  </Badge>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => {
                    setEditLead(null);
                    setDefaultStatusId(status.id);
                    setDialogOpen(true);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Droppable column */}
              <Droppable droppableId={status.id} type="LEAD">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`min-h-[200px] rounded-b-lg border border-border p-2 space-y-2 transition-colors ${
                      snapshot.isDraggingOver ? "bg-primary/5" : "bg-card"
                    }`}
                  >
                    {(leadsByStatus[status.id] ?? []).map((lead, index) => (
                      <Draggable key={lead.id} draggableId={lead.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`bg-background border border-border rounded-lg p-3 cursor-pointer transition-shadow ${
                              snapshot.isDragging ? "shadow-lg ring-2 ring-primary/20" : "hover:shadow-sm"
                            }`}
                            onClick={() => {
                              setEditLead(lead);
                              setDialogOpen(true);
                            }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
                                  </div>
                                  <p className="text-sm font-bold truncate">{lead.name}</p>
                                </div>
                                {lead.company_name && (
                                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                    <Building2 className="h-3 w-3" />
                                    <span className="truncate">{lead.company_name}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                                  {lead.email && (
                                    <span className="flex items-center gap-0.5 truncate">
                                      <Mail className="h-3 w-3" /> {lead.email}
                                    </span>
                                  )}
                                  {lead.phone && (
                                    <span className="flex items-center gap-0.5">
                                      <Phone className="h-3 w-3" /> {lead.phone}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                {lead.value > 0 && (
                                  <Badge variant="outline" className="text-[10px] font-mono">
                                    €{lead.value.toLocaleString()}
                                  </Badge>
                                )}
                                <div className="flex gap-0.5" onClick={(e) => e.stopPropagation()}>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6"
                                    onClick={() => { setEditLead(lead); setDialogOpen(true); }}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 text-destructive"
                                    onClick={() => setDeleteId(lead.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                            {lead.source && (
                              <div className="mt-2">
                                <Badge variant="secondary" className="text-[9px]">{lead.source}</Badge>
                              </div>
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>

      <LeadDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        statuses={statuses ?? []}
        lead={editLead}
        defaultStatusId={defaultStatusId}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lead verwijderen?</AlertDialogTitle>
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

export default LeadsPage;
