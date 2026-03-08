import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useCreateLead, useUpdateLead, useLeadFormFields, type Lead, type LeadStatus } from "@/hooks/useLeads";
import { useToast } from "@/hooks/use-toast";

interface LeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statuses: LeadStatus[];
  lead?: Lead | null;
  defaultStatusId?: string;
}

const LeadDialog = ({ open, onOpenChange, statuses, lead, defaultStatusId }: LeadDialogProps) => {
  const { toast } = useToast();
  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const { data: formFields } = useLeadFormFields();

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company_name: "",
    source: "",
    value: "",
    notes: "",
    status_id: "",
    custom_fields: {} as Record<string, any>,
  });

  useEffect(() => {
    if (open) {
      if (lead) {
        setForm({
          name: lead.name,
          email: lead.email || "",
          phone: lead.phone || "",
          company_name: lead.company_name || "",
          source: lead.source || "",
          value: lead.value ? String(lead.value) : "",
          notes: lead.notes || "",
          status_id: lead.status_id,
          custom_fields: lead.custom_fields || {},
        });
      } else {
        setForm({
          name: "",
          email: "",
          phone: "",
          company_name: "",
          source: "",
          value: "",
          notes: "",
          status_id: defaultStatusId || statuses[0]?.id || "",
          custom_fields: {},
        });
      }
    }
  }, [open, lead, defaultStatusId, statuses]);

  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));
  const setCustom = (key: string, val: string) =>
    setForm((f) => ({ ...f, custom_fields: { ...f.custom_fields, [key]: val } }));

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.status_id) return;
    try {
      const payload = {
        name: form.name,
        email: form.email || null,
        phone: form.phone || null,
        company_name: form.company_name || null,
        source: form.source || null,
        value: form.value ? parseFloat(form.value) : 0,
        notes: form.notes || null,
        status_id: form.status_id,
        custom_fields: form.custom_fields,
      };

      if (lead) {
        await updateLead.mutateAsync({ id: lead.id, ...payload });
        toast({ title: "Lead bijgewerkt" });
      } else {
        await createLead.mutateAsync(payload as any);
        toast({ title: "Lead aangemaakt" });
      }
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  const loading = createLead.isPending || updateLead.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lead ? "Lead bewerken" : "Nieuwe lead"}</DialogTitle>
          <DialogDescription>Vul de gegevens van de lead in.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <Label className="text-sm font-medium">Naam *</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Naam" className="mt-1" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">E-mail</Label>
              <Input value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="email@..." className="mt-1" type="email" />
            </div>
            <div>
              <Label className="text-sm font-medium">Telefoon</Label>
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="06..." className="mt-1" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Bedrijf</Label>
              <Input value={form.company_name} onChange={(e) => set("company_name", e.target.value)} placeholder="Bedrijfsnaam" className="mt-1" />
            </div>
            <div>
              <Label className="text-sm font-medium">Bron</Label>
              <Input value={form.source} onChange={(e) => set("source", e.target.value)} placeholder="Website, LinkedIn..." className="mt-1" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Waarde (€)</Label>
              <Input value={form.value} onChange={(e) => set("value", e.target.value)} placeholder="0" className="mt-1" type="number" />
            </div>
            <div>
              <Label className="text-sm font-medium">Status</Label>
              <Select value={form.status_id} onValueChange={(v) => set("status_id", v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Custom form fields */}
          {formFields && formFields.length > 0 && (
            <div className="border-t border-border pt-3 space-y-3">
              {formFields.map((f) => (
                <div key={f.id}>
                  <Label className="text-sm font-medium">
                    {f.field_label} {f.is_required && "*"}
                  </Label>
                  {f.field_type === "textarea" ? (
                    <Textarea
                      value={form.custom_fields[f.field_name] || ""}
                      onChange={(e) => setCustom(f.field_name, e.target.value)}
                      className="mt-1"
                      rows={2}
                    />
                  ) : f.field_type === "select" && Array.isArray(f.options) ? (
                    <Select
                      value={form.custom_fields[f.field_name] || ""}
                      onValueChange={(v) => setCustom(f.field_name, v)}
                    >
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(f.options as string[]).map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={form.custom_fields[f.field_name] || ""}
                      onChange={(e) => setCustom(f.field_name, e.target.value)}
                      className="mt-1"
                      type={f.field_type === "number" ? "number" : "text"}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <div>
            <Label className="text-sm font-medium">Notities</Label>
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Opmerkingen..." className="mt-1" rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
          <Button onClick={handleSubmit} disabled={loading || !form.name.trim()}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {lead ? "Opslaan" : "Aanmaken"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LeadDialog;
