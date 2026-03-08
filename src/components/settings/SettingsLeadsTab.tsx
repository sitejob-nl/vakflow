import { useState } from "react";
import {
  useLeadStatuses, useUpsertLeadStatus, useDeleteLeadStatus, useReorderLeadStatuses,
  useLeadFormFields, useUpsertLeadFormField, useDeleteLeadFormField,
  type LeadStatus, type LeadFormField,
} from "@/hooks/useLeads";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, GripVertical, Pencil, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SETTINGS_INPUT_CLASS, SETTINGS_LABEL_CLASS } from "./shared";

const SettingsLeadsTab = () => {
  const { toast } = useToast();
  const { data: statuses, isLoading: sLoading } = useLeadStatuses();
  const upsertStatus = useUpsertLeadStatus();
  const deleteStatus = useDeleteLeadStatus();
  const reorderStatuses = useReorderLeadStatuses();
  const { data: fields, isLoading: fLoading } = useLeadFormFields();
  const upsertField = useUpsertLeadFormField();
  const deleteField = useDeleteLeadFormField();

  // Status editing
  const [newStatusName, setNewStatusName] = useState("");
  const [newStatusColor, setNewStatusColor] = useState("#3b82f6");
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);

  // Field editing
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState("text");
  const [newFieldRequired, setNewFieldRequired] = useState(false);

  const handleAddStatus = async () => {
    if (!newStatusName.trim()) return;
    try {
      await upsertStatus.mutateAsync({
        name: newStatusName,
        color: newStatusColor,
        sort_order: (statuses?.length ?? 0),
      });
      setNewStatusName("");
      setNewStatusColor("#3b82f6");
      toast({ title: "Status toegevoegd" });
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  const handleDeleteStatus = async (id: string) => {
    try {
      await deleteStatus.mutateAsync(id);
      toast({ title: "Status verwijderd" });
    } catch (err: any) {
      toast({ title: "Fout", description: err.message === 'update or delete on table "lead_statuses" violates foreign key constraint "leads_status_id_fkey" on table "leads"'
        ? "Kan niet verwijderen: er zijn nog leads met deze status"
        : err.message, variant: "destructive" });
    }
  };

  const handleAddField = async () => {
    if (!newFieldLabel.trim()) return;
    const fieldName = newFieldName.trim() || newFieldLabel.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    try {
      await upsertField.mutateAsync({
        field_label: newFieldLabel,
        field_name: fieldName,
        field_type: newFieldType,
        is_required: newFieldRequired,
        sort_order: (fields?.length ?? 0),
      });
      setNewFieldLabel("");
      setNewFieldName("");
      setNewFieldType("text");
      setNewFieldRequired(false);
      toast({ title: "Veld toegevoegd" });
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  const handleDeleteField = async (id: string) => {
    try {
      await deleteField.mutateAsync(id);
      toast({ title: "Veld verwijderd" });
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  const colors = ["#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1"];

  return (
    <div className="space-y-6">
      {/* Lead Statuses */}
      <div className="bg-card border border-border rounded-lg shadow-card p-5 md:p-6">
        <h3 className="text-sm font-bold mb-4">Lead statussen (Kanban kolommen)</h3>

        {sLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-2 mb-4">
            {(statuses ?? []).map((s, i) => (
              <div key={s.id} className="flex items-center gap-2 bg-background border border-border rounded-md px-3 py-2">
                <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                <span className="text-sm font-medium flex-1">{s.name}</span>
                <span className="text-[10px] text-muted-foreground">#{i + 1}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-destructive"
                  onClick={() => handleDeleteStatus(s.id)}
                  disabled={deleteStatus.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label className={SETTINGS_LABEL_CLASS}>Nieuwe status</Label>
            <Input
              value={newStatusName}
              onChange={(e) => setNewStatusName(e.target.value)}
              placeholder="Bijv. Follow-up"
              className={SETTINGS_INPUT_CLASS}
            />
          </div>
          <div>
            <Label className={SETTINGS_LABEL_CLASS}>Kleur</Label>
            <div className="flex gap-1 mt-1">
              {colors.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewStatusColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${
                    newStatusColor === c ? "border-foreground scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <Button size="sm" onClick={handleAddStatus} disabled={!newStatusName.trim() || upsertStatus.isPending}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Toevoegen
          </Button>
        </div>
      </div>

      {/* Custom Form Fields */}
      <div className="bg-card border border-border rounded-lg shadow-card p-5 md:p-6">
        <h3 className="text-sm font-bold mb-1">Eigen lead-velden</h3>
        <p className="text-xs text-muted-foreground mb-4">Voeg extra velden toe aan het lead formulier.</p>

        {fLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-2 mb-4">
            {(fields ?? []).map((f) => (
              <div key={f.id} className="flex items-center gap-2 bg-background border border-border rounded-md px-3 py-2">
                <span className="text-sm font-medium flex-1">{f.field_label}</span>
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{f.field_type}</span>
                {f.is_required && <span className="text-[10px] text-destructive font-bold">Verplicht</span>}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-destructive"
                  onClick={() => handleDeleteField(f.id)}
                  disabled={deleteField.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {(!fields || fields.length === 0) && (
              <p className="text-xs text-muted-foreground italic">Geen eigen velden. De standaard velden (naam, email, telefoon, bedrijf, bron, waarde, notities) zijn altijd beschikbaar.</p>
            )}
          </div>
        )}

        <div className="flex items-end gap-2 flex-wrap">
          <div className="flex-1 min-w-[140px]">
            <Label className={SETTINGS_LABEL_CLASS}>Veldnaam</Label>
            <Input
              value={newFieldLabel}
              onChange={(e) => setNewFieldLabel(e.target.value)}
              placeholder="Bijv. Budget range"
              className={SETTINGS_INPUT_CLASS}
            />
          </div>
          <div className="w-[120px]">
            <Label className={SETTINGS_LABEL_CLASS}>Type</Label>
            <Select value={newFieldType} onValueChange={setNewFieldType}>
              <SelectTrigger className={SETTINGS_INPUT_CLASS}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Tekst</SelectItem>
                <SelectItem value="number">Nummer</SelectItem>
                <SelectItem value="textarea">Tekstvlak</SelectItem>
                <SelectItem value="select">Keuzelijst</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={newFieldRequired} onCheckedChange={setNewFieldRequired} />
            <Label className="text-xs">Verplicht</Label>
          </div>
          <Button size="sm" onClick={handleAddField} disabled={!newFieldLabel.trim() || upsertField.isPending}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Toevoegen
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SettingsLeadsTab;
