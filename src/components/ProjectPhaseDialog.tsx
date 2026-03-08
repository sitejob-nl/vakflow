import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateProjectPhase, useUpdateProjectPhase, type ProjectPhase } from "@/hooks/useProjects";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  editPhase?: ProjectPhase | null;
  nextSortOrder?: number;
}

const ProjectPhaseDialog = ({ open, onOpenChange, projectId, editPhase, nextSortOrder = 0 }: Props) => {
  const createPhase = useCreateProjectPhase();
  const updatePhase = useUpdateProjectPhase();
  const { toast } = useToast();

  const [form, setForm] = useState({
    name: "",
    description: "",
    sort_order: nextSortOrder,
    start_date: "",
    end_date: "",
    budget_amount: 0,
    status: "gepland",
  });

  useEffect(() => {
    if (editPhase) {
      setForm({
        name: editPhase.name,
        description: editPhase.description ?? "",
        sort_order: editPhase.sort_order,
        start_date: editPhase.start_date ?? "",
        end_date: editPhase.end_date ?? "",
        budget_amount: editPhase.budget_amount ?? 0,
        status: editPhase.status,
      });
    } else {
      setForm({
        name: "",
        description: "",
        sort_order: nextSortOrder,
        start_date: "",
        end_date: "",
        budget_amount: 0,
        status: "gepland",
      });
    }
  }, [editPhase, open, nextSortOrder]);

  const set = (key: string, value: unknown) => setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "Vul een fasenaam in", variant: "destructive" });
      return;
    }
    const payload: any = {
      project_id: projectId,
      name: form.name.trim(),
      description: form.description || null,
      sort_order: form.sort_order,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      budget_amount: form.budget_amount || 0,
      status: form.status,
    };
    try {
      if (editPhase) {
        await updatePhase.mutateAsync({ id: editPhase.id, ...payload });
        toast({ title: "Fase bijgewerkt" });
      } else {
        await createPhase.mutateAsync(payload);
        toast({ title: "Fase toegevoegd" });
      }
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  const loading = createPhase.isPending || updatePhase.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editPhase ? "Fase bewerken" : "Nieuwe fase"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Naam *</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Bijv. Fase 1: Sloop" />
          </div>
          <div className="space-y-1.5">
            <Label>Beschrijving</Label>
            <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Startdatum</Label>
              <Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Einddatum</Label>
              <Input type="date" value={form.end_date} onChange={(e) => set("end_date", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Deelbudget (€)</Label>
              <Input type="number" value={form.budget_amount || ""} onChange={(e) => set("budget_amount", Number(e.target.value) || 0)} step="0.01" />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gepland">Gepland</SelectItem>
                  <SelectItem value="actief">Actief</SelectItem>
                  <SelectItem value="afgerond">Afgerond</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editPhase ? "Opslaan" : "Toevoegen"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectPhaseDialog;
