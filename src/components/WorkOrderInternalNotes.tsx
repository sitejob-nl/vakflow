import { useState } from "react";
import { Lock, Plus, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useUpdateWorkOrder } from "@/hooks/useWorkOrders";
import { useToast } from "@/hooks/use-toast";

interface Props {
  workOrderId: string;
  internalNotes: string | null;
}

export default function WorkOrderInternalNotes({ workOrderId, internalNotes }: Props) {
  const { toast } = useToast();
  const updateWO = useUpdateWorkOrder();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(internalNotes ?? "");

  const handleSave = async () => {
    try {
      await updateWO.mutateAsync({ id: workOrderId, internal_notes: draft || null } as any);
      setEditing(false);
      toast({ title: "Interne notities opgeslagen" });
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="bg-warning-muted/30 border border-warning/30 rounded-sm p-4">
      <div className="flex items-center gap-1.5 mb-3">
        <Lock className="h-3.5 w-3.5 text-warning" />
        <h4 className="text-[11px] uppercase tracking-widest text-warning font-bold">
          Interne notities
        </h4>
        <span className="text-[10px] text-warning/70 ml-1">(niet zichtbaar voor klant)</span>
      </div>

      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            placeholder="Bijv. onderdeel besteld, wacht op levering... of 'klant was niet tevreden, gratis herbezoek'"
            className="bg-background"
            autoFocus
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={updateWO.isPending}>
              {updateWO.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Opslaan"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setEditing(false); setDraft(internalNotes ?? ""); }}>
              Annuleren
            </Button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => { setDraft(internalNotes ?? ""); setEditing(true); }}
          className="cursor-pointer hover:bg-warning/10 rounded-sm p-1 -m-1 transition-colors min-h-[40px]"
        >
          {internalNotes ? (
            <p className="text-[13px] text-secondary-foreground leading-relaxed whitespace-pre-wrap">{internalNotes}</p>
          ) : (
            <p className="text-[13px] text-t3 italic flex items-center gap-1">
              <Plus className="h-3 w-3" /> Klik om interne notities toe te voegen...
            </p>
          )}
        </div>
      )}
    </div>
  );
}
