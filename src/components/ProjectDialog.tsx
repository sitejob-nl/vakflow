import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import CustomerCombobox from "@/components/CustomerCombobox";
import { useCustomers } from "@/hooks/useCustomers";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useCreateProject, useUpdateProject, type Project } from "@/hooks/useProjects";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editProject?: Project | null;
}

const statusOptions = [
  { value: "gepland", label: "Gepland" },
  { value: "actief", label: "Actief" },
  { value: "gepauzeerd", label: "Gepauzeerd" },
  { value: "afgerond", label: "Afgerond" },
  { value: "geannuleerd", label: "Geannuleerd" },
];

const ProjectDialog = ({ open, onOpenChange, editProject }: Props) => {
  const { data: customers } = useCustomers();
  const { data: teamMembers } = useTeamMembers();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const { toast } = useToast();

  const [form, setForm] = useState({
    customer_id: "",
    name: "",
    description: "",
    assigned_to: "",
    start_date: "",
    end_date: "",
    deadline: "",
    budget_amount: 0,
    status: "gepland",
    notes: "",
  });

  useEffect(() => {
    if (editProject) {
      setForm({
        customer_id: editProject.customer_id,
        name: editProject.name,
        description: editProject.description ?? "",
        assigned_to: editProject.assigned_to ?? "",
        start_date: editProject.start_date ?? "",
        end_date: editProject.end_date ?? "",
        deadline: editProject.deadline ?? "",
        budget_amount: editProject.budget_amount ?? 0,
        status: editProject.status,
        notes: editProject.notes ?? "",
      });
    } else {
      setForm({
        customer_id: "",
        name: "",
        description: "",
        assigned_to: "",
        start_date: new Date().toISOString().split("T")[0],
        end_date: "",
        deadline: "",
        budget_amount: 0,
        status: "gepland",
        notes: "",
      });
    }
  }, [editProject, open]);

  const set = (key: string, value: unknown) => setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    if (!form.customer_id) {
      toast({ title: "Selecteer een klant", variant: "destructive" });
      return;
    }
    if (!form.name.trim()) {
      toast({ title: "Vul een projectnaam in", variant: "destructive" });
      return;
    }

    const payload: any = {
      customer_id: form.customer_id,
      name: form.name.trim(),
      description: form.description || null,
      assigned_to: form.assigned_to || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      deadline: form.deadline || null,
      budget_amount: form.budget_amount || 0,
      status: form.status,
      notes: form.notes || null,
    };

    try {
      if (editProject) {
        await updateProject.mutateAsync({ id: editProject.id, ...payload });
        toast({ title: "Project bijgewerkt" });
      } else {
        const p = await createProject.mutateAsync(payload);
        toast({ title: `Project ${(p as any).project_number} aangemaakt` });
      }
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  const loading = createProject.isPending || updateProject.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editProject ? "Project bewerken" : "Nieuw project"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Klant *</Label>
            <CustomerCombobox customers={customers} value={form.customer_id} onValueChange={(v) => set("customer_id", v)} />
          </div>
          <div className="space-y-1.5">
            <Label>Projectnaam *</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Bijv. Dakrenovatie Jansen" />
          </div>
          <div className="space-y-1.5">
            <Label>Beschrijving</Label>
            <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Korte omschrijving van het project" rows={3} />
          </div>
          {teamMembers && teamMembers.length > 0 && (
            <div className="space-y-1.5">
              <Label>Toegewezen aan</Label>
              <Select value={form.assigned_to} onValueChange={(v) => set("assigned_to", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Niemand" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Niemand</SelectItem>
                  {teamMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name || m.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
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
              <Label>Deadline</Label>
              <Input type="date" value={form.deadline} onChange={(e) => set("deadline", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Budget (€)</Label>
              <Input type="number" value={form.budget_amount || ""} onChange={(e) => set("budget_amount", Number(e.target.value) || 0)} placeholder="0.00" step="0.01" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {statusOptions.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Notities</Label>
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editProject ? "Opslaan" : "Aanmaken"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectDialog;
