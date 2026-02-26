import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useCreateService, useUpdateService } from "@/hooks/useCustomers";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service?: Tables<"services"> | null;
  onCreated?: (service: Tables<"services">) => void;
}

const categoryOptions = [
  { value: "MV", label: "MV (Mechanische Ventilatie)" },
  { value: "WTW", label: "WTW (Warmteterugwinning)" },
];

const colorOptions = [
  { value: "#3b82f6", label: "Blauw" },
  { value: "#22c55e", label: "Groen" },
  { value: "#f59e0b", label: "Oranje" },
  { value: "#ef4444", label: "Rood" },
  { value: "#8b5cf6", label: "Paars" },
  { value: "#ec4899", label: "Roze" },
  { value: "#14b8a6", label: "Teal" },
  { value: "#64748b", label: "Grijs" },
];

const ServiceDialog = ({ open, onOpenChange, service, onCreated }: Props) => {
  const { toast } = useToast();
  const createService = useCreateService();
  const updateService = useUpdateService();
  const isEdit = !!service;

  const [form, setForm] = useState({ name: "", price: "", category: "", color: "#3b82f6", duration_minutes: "60" });

  useEffect(() => {
    if (open) {
      if (service) {
        setForm({
          name: service.name,
          price: service.price.toString(),
          category: service.category || "",
          color: service.color || "#3b82f6",
          duration_minutes: ((service as any).duration_minutes ?? 60).toString(),
        });
      } else {
        setForm({ name: "", price: "", category: "", color: "#3b82f6", duration_minutes: "60" });
      }
    }
  }, [open, service]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      price: parseFloat(form.price) || 0,
      category: form.category || null,
      color: form.color || null,
      duration_minutes: parseInt(form.duration_minutes) || 60,
    };
    try {
      if (isEdit) {
        await updateService.mutateAsync({ id: service!.id, ...payload });
        toast({ title: "Dienst bijgewerkt" });
      } else {
        const result = await createService.mutateAsync(payload);
        onCreated?.(result);
        toast({ title: "Dienst aangemaakt" });
      }
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  const isPending = createService.isPending || updateService.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Dienst bewerken" : "Nieuwe dienst"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Naam *</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Prijs incl. BTW (€) *</Label>
              <Input type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>Duur (min)</Label>
              <Input type="number" min="15" step="15" value={form.duration_minutes} onChange={(e) => setForm((f) => ({ ...f, duration_minutes: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Categorie</Label>
            <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
              <SelectTrigger><SelectValue placeholder="Kies categorie" /></SelectTrigger>
              <SelectContent>
                {categoryOptions.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Kleur</Label>
            <div className="flex gap-2 flex-wrap">
              {colorOptions.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  onClick={() => setForm((f) => ({ ...f, color: c.value }))}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${form.color === c.value ? "border-foreground scale-110" : "border-transparent hover:scale-105"}`}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
            <Button type="submit" disabled={isPending || !form.name}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Opslaan" : "Aanmaken"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ServiceDialog;
