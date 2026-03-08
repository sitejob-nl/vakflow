import { useNavigation } from "@/hooks/useNavigation";
import { useWorkOrder, useUpdateWorkOrder } from "@/hooks/useWorkOrders";
import { useCreateInvoice } from "@/hooks/useInvoices";
import { Loader2, Plus, Download, AlertTriangle } from "lucide-react";
import PhotoUpload from "@/components/PhotoUpload";
import WorkOrderTimer from "@/components/WorkOrderTimer";
import WorkOrderMaterials from "@/components/WorkOrderMaterials";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import WorkOrderDialog from "@/components/WorkOrderDialog";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useIndustryConfig } from "@/hooks/useIndustryConfig";
import { useCreateMileageLog } from "@/hooks/useVehicles";

interface NoteItem {
  text: string;
  created_at: string;
}

const statusBadge: Record<string, string> = {
  open: "bg-cyan-muted text-cyan",
  bezig: "bg-warning-muted text-warning",
  afgerond: "bg-success-muted text-success",
};

const statusLabel: Record<string, string> = {
  open: "Open",
  bezig: "Bezig",
  afgerond: "Afgerond",
};

const WorkOrderDetailPage = () => {
  const { navigate, params } = useNavigation();
  const { toast } = useToast();
  const { labels } = useIndustryConfig();
  const { data: wo, isLoading } = useWorkOrder(params.workOrderId);
  const updateWO = useUpdateWorkOrder();
  const createInvoice = useCreateInvoice();
  const [editOpen, setEditOpen] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [newNote, setNewNote] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    if (!wo) return;
    setDownloadingPdf(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-workorder-pdf", {
        body: { work_order_id: wo.id },
      });
      if (error) throw error;
      const blob = data instanceof Blob ? data : new Blob([data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${labels.workOrder}_${wo.work_order_number || wo.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: "PDF downloaden mislukt", description: err.message, variant: "destructive" });
    }
    setDownloadingPdf(false);
  };

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!wo) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">{labels.workOrder} niet gevonden</p>
        <button onClick={() => navigate("workorders")} className="mt-4 text-primary text-sm font-bold hover:underline">Terug naar {labels.workOrders.toLowerCase()}</button>
      </div>
    );
  }

  const notes: NoteItem[] = Array.isArray((wo as any).notes) ? ((wo as any).notes as NoteItem[]) : [];

  const handleDescriptionSave = async () => {
    try {
      await updateWO.mutateAsync({ id: wo.id, description: descriptionDraft || null } as any);
      setEditingDescription(false);
      toast({ title: "Werkzaamheden opgeslagen" });
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    const updatedNotes = [...notes, { text: newNote.trim(), created_at: new Date().toISOString() }];
    try {
      await updateWO.mutateAsync({ id: wo.id, notes: updatedNotes } as any);
      setNewNote("");
      setShowNoteInput(false);
      toast({ title: "Opmerking toegevoegd" });
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  const handleStatusChange = async (status: string) => {
    try {
      await updateWO.mutateAsync({
        id: wo.id,
        status,
        completed_at: status === "afgerond" ? new Date().toISOString() : null,
      });
      toast({ title: `Status gewijzigd naar ${statusLabel[status]}` });

      // Trigger automation on completion
      if (status === "afgerond") {
        try {
          await supabase.functions.invoke("whatsapp-automation-trigger", {
            body: {
              trigger_type: "work_order_completed",
              customer_id: wo.customer_id,
              context: {
                work_order: {
                  number: wo.work_order_number ?? "",
                  service: (wo as any).services?.name ?? "",
                },
              },
            },
          });
        } catch {
          // Automation failure shouldn't block status change
        }
      }
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  const handleCreateInvoice = async () => {
    try {
      const servicePrice = (wo as any).services?.price ?? 0;
      const serviceName = (wo as any).services?.name ?? "Dienst";
      const travelCost = wo.travel_cost ?? 0;
      const totalInclBtw = servicePrice + travelCost;
      const vatPercentage = 21;
      const subtotal = totalInclBtw / (1 + vatPercentage / 100);
      const vatAmount = totalInclBtw - subtotal;
      const total = totalInclBtw;

      const issuedAt = new Date().toISOString().split("T")[0];
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);
      const dueAt = dueDate.toISOString().split("T")[0];

      const items = [
        { description: serviceName, qty: 1, unit_price: servicePrice, total: servicePrice },
      ];
      if (travelCost > 0) {
        items.push({ description: "Voorrijkosten", qty: 1, unit_price: travelCost, total: travelCost });
      }

      await createInvoice.mutateAsync({
        customer_id: wo.customer_id,
        work_order_id: wo.id,
        subtotal,
        vat_percentage: vatPercentage,
        vat_amount: vatAmount,
        total,
        status: "concept",
        issued_at: issuedAt,
        due_at: dueAt,
        items: items as any,
      });
      toast({ title: "Factuur aangemaakt als concept" });
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  const servicePrice = (wo as any).services?.price ?? 0;
  const travelCost = wo.travel_cost ?? 0;
  const totalInclBtw = wo.total_amount ?? servicePrice + travelCost;
  const subtotalExclBtw = totalInclBtw / 1.21;
  const vatAmount = totalInclBtw - subtotalExclBtw;

  return (
    <div>
      <div className="mb-4 flex items-center gap-2.5 flex-wrap">
        <button onClick={() => navigate("workorders")} className="px-3 py-1.5 text-[12px] font-semibold text-t3 hover:text-foreground hover:bg-bg-hover rounded-sm transition-colors">
          ← Terug
        </button>
        <div className="flex-1" />
        <span className={`inline-flex px-2.5 py-[3px] rounded-full text-[11px] font-bold ${statusBadge[wo.status] ?? statusBadge.open}`}>
          {statusLabel[wo.status] ?? wo.status}
        </span>
        <span className="font-mono text-[12px] text-t3">{wo.work_order_number}</span>
      </div>

      <h2 className="text-lg md:text-xl font-extrabold mb-1">
        {(wo as any).services?.name ?? labels.workOrder}
      </h2>
        <p className="text-secondary-foreground text-sm mb-4">
        {(wo as any).customers?.name} · {[(wo as any).customers?.address, (wo as any).customers?.city].filter(Boolean).join(", ")} · €{totalInclBtw.toFixed(2)}
      </p>

      {/* Status actions */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {wo.status === "open" && (
          <button onClick={() => handleStatusChange("bezig")} className="px-4 py-2 bg-warning text-warning-foreground rounded-sm text-[13px] font-bold hover:opacity-90 transition-colors">
            ▶ Start {labels.workOrder.toLowerCase()}
          </button>
        )}
        {wo.status === "bezig" && (
          <button onClick={() => setConfirmFinish(true)} className="px-4 py-2 bg-accent text-accent-foreground rounded-sm text-[13px] font-bold hover:opacity-90 transition-colors">
            ✓ Afronden
          </button>
        )}
        {wo.status === "afgerond" && (
          <button onClick={handleCreateInvoice} disabled={createInvoice.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-sm text-[13px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50">
            {createInvoice.isPending ? "Bezig..." : "📄 Maak factuur"}
          </button>
        )}
        <button onClick={() => setEditOpen(true)} className="px-4 py-2 bg-card border border-border rounded-sm text-[13px] font-bold text-secondary-foreground hover:bg-bg-hover transition-colors">
          Bewerken
        </button>
        <button onClick={handleDownloadPdf} disabled={downloadingPdf} className="px-4 py-2 bg-card border border-border rounded-sm text-[13px] font-bold text-secondary-foreground hover:bg-bg-hover transition-colors disabled:opacity-50 flex items-center gap-1.5">
          {downloadingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          PDF
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Left */}
        <div>
          {/* Werkzaamheden (description) */}
          <div className="bg-background border border-border rounded-sm p-4 mb-3">
            <h4 className="text-[11px] uppercase tracking-widest text-t3 mb-3 font-bold">Werkzaamheden</h4>
            {editingDescription ? (
              <div className="space-y-2">
                <Textarea
                  value={descriptionDraft}
                  onChange={(e) => setDescriptionDraft(e.target.value)}
                  rows={4}
                  placeholder="Beschrijf wat er is gedaan..."
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleDescriptionSave} disabled={updateWO.isPending}>
                    {updateWO.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Opslaan"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingDescription(false)}>Annuleren</Button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => { setDescriptionDraft((wo as any).description || ""); setEditingDescription(true); }}
                className="cursor-pointer hover:bg-bg-hover rounded-sm p-1 -m-1 transition-colors min-h-[40px]"
              >
                {(wo as any).description ? (
                  <p className="text-[13px] text-secondary-foreground leading-relaxed whitespace-pre-wrap">{(wo as any).description}</p>
                ) : (
                  <p className="text-[13px] text-t3 italic">Klik om werkzaamheden te beschrijven...</p>
                )}
              </div>
            )}
          </div>

          {/* Opmerkingen / Notes */}
          <div className="bg-background border border-border rounded-sm p-4 mb-3">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-[11px] uppercase tracking-widest text-t3 font-bold">Opmerkingen</h4>
              <button
                onClick={() => setShowNoteInput(true)}
                className="flex items-center gap-1 text-[11px] font-bold text-primary hover:text-primary-hover transition-colors"
              >
                <Plus className="h-3 w-3" /> Toevoegen
              </button>
            </div>

            {showNoteInput && (
              <div className="mb-3 space-y-2">
                <Textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  rows={2}
                  placeholder="Bijv. over een maand opnieuw komen..."
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddNote} disabled={updateWO.isPending || !newNote.trim()}>
                    {updateWO.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Opslaan"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setShowNoteInput(false); setNewNote(""); }}>Annuleren</Button>
                </div>
              </div>
            )}

            {notes.length === 0 && !wo.remarks && !showNoteInput && (
              <p className="text-[13px] text-t3 italic">Geen opmerkingen</p>
            )}

            {wo.remarks && notes.length === 0 && (
              <p className="text-[13px] text-secondary-foreground leading-relaxed">{wo.remarks}</p>
            )}

            {notes.length > 0 && (
              <div className="space-y-2">
                {notes.map((note, i) => (
                  <div key={i} className="border-l-2 border-primary/30 pl-3 py-1">
                    <p className="text-[13px] text-secondary-foreground">{note.text}</p>
                    <p className="text-[10px] text-t3 mt-0.5">
                      {format(new Date(note.created_at), "d MMM yyyy 'om' HH:mm", { locale: nl })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-background border border-border rounded-sm p-4">
            <h4 className="text-[11px] uppercase tracking-widest text-t3 mb-3 font-bold">Dienst & tarieven</h4>
            <div className="text-[13px]">
              <div className="flex justify-between py-[5px] border-b border-border">
                <span>{(wo as any).services?.name ?? "Dienst"}</span>
                <strong>€{servicePrice.toFixed(2)}</strong>
              </div>
              <div className="flex justify-between py-[5px] border-b border-border text-t3">
                <span>Voorrijkosten</span>
                <span>€{travelCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-[5px] border-b border-border">
                <span>Subtotaal (excl. BTW)</span>
                <span>€{subtotalExclBtw.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-[5px] border-b border-border text-t3">
                <span>BTW 21%</span>
                <span>€{vatAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-2 font-extrabold text-primary">
                <span>Totaal (incl. BTW)</span>
                <span>€{totalInclBtw.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right */}
        <div>
          <div className="bg-background border border-border rounded-sm p-4 mb-3">
            <h4 className="text-[11px] uppercase tracking-widest text-t3 mb-3 font-bold">Klantgegevens</h4>
            <div className="text-[13px] space-y-1.5">
              {[
                ["Klant", (wo as any).customers?.name],
                ["Contact", (wo as any).customers?.contact_person],
                ["Telefoon", (wo as any).customers?.phone],
                ["E-mail", (wo as any).customers?.email],
                ["Adres", [(wo as any).customers?.address, (wo as any).customers?.city].filter(Boolean).join(", ")],
              ].map(([l, v]) => (
                <div key={l as string} className="flex justify-between">
                  <span className="text-t3">{l}</span>
                  {v ? (
                    <span className="font-semibold text-right">{v}</span>
                  ) : l === "Telefoon" ? (
                    <button onClick={() => navigate("custDetail", { customerId: wo.customer_id })} className="text-[12px] text-primary hover:underline font-semibold">Voeg toe</button>
                  ) : (
                    <span className="font-semibold text-right">—</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Tijdregistratie */}
          <div className="mb-3">
            <WorkOrderTimer workOrderId={wo.id} />
          </div>

          {/* Materialen */}
          <div className="mb-3">
            <WorkOrderMaterials workOrderId={wo.id} />
          </div>

          <div className="bg-background border border-border rounded-sm p-4 mb-3">
            <PhotoUpload
              workOrderId={wo.id}
              type="before"
              photos={wo.photos_before ?? []}
              onPhotosChange={async (photos) => {
                try {
                  await updateWO.mutateAsync({ id: wo.id, photos_before: photos });
                } catch (err: any) {
                  toast({ title: "Fout", description: err.message, variant: "destructive" });
                }
              }}
            />
          </div>

          <div className="bg-background border border-border rounded-sm p-4 mb-3">
            <PhotoUpload
              workOrderId={wo.id}
              type="after"
              photos={wo.photos_after ?? []}
              onPhotosChange={async (photos) => {
                try {
                  await updateWO.mutateAsync({ id: wo.id, photos_after: photos });
                } catch (err: any) {
                  toast({ title: "Fout", description: err.message, variant: "destructive" });
                }
              }}
            />
          </div>
          {wo.signed_by && (
            <div className="bg-background border border-border rounded-sm p-4 mb-3">
              <h4 className="text-[11px] uppercase tracking-widest text-t3 mb-3 font-bold">Handtekening klant</h4>
              <p className="text-[12px] text-t3">
                {wo.signed_by} · {wo.signed_at ? format(new Date(wo.signed_at), "d MMM yyyy HH:mm", { locale: nl }) : ""}
              </p>
            </div>
          )}

          {wo.completed_at && (
            <div className="bg-success-muted border border-success/20 rounded-sm p-4 mb-3">
              <h4 className="text-[11px] uppercase tracking-widest text-success mb-1 font-bold">Afgerond</h4>
              <p className="text-[13px] font-semibold text-success">
                {format(new Date(wo.completed_at), "d MMMM yyyy 'om' HH:mm", { locale: nl })}
              </p>
            </div>
          )}

          <div className="text-[11px] text-t3 mt-3">
            Aangemaakt: {format(new Date(wo.created_at), "d MMM yyyy HH:mm", { locale: nl })}
          </div>
        </div>
      </div>

      <WorkOrderDialog open={editOpen} onOpenChange={setEditOpen} workOrder={wo} />

      {/* Confirmation dialog for finishing */}
      <AlertDialog open={confirmFinish} onOpenChange={setConfirmFinish}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{labels.workOrder} afronden?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze {labels.workOrder.toLowerCase()} wilt afronden? Dit markeert de {labels.workOrder.toLowerCase()} als voltooid.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleStatusChange("afgerond")}>Afronden</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default WorkOrderDetailPage;
