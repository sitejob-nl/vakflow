import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import CustomerCombobox from "@/components/CustomerCombobox";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useCreateWorkOrder, useUpdateWorkOrder } from "@/hooks/useWorkOrders";
import { useCustomers } from "@/hooks/useCustomers";
import { useServices } from "@/hooks/useCustomers";
import { useAssets } from "@/hooks/useAssets";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workOrder?: Tables<"work_orders"> | null;
}

const WorkOrderDialog = ({ open, onOpenChange, workOrder }: Props) => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { isAdmin, user, role } = useAuth();
  const { data: customers } = useCustomers();
  const { data: services } = useServices();
  const { data: allAssets } = useAssets();
  const { data: teamMembers } = useTeamMembers();
  const createWO = useCreateWorkOrder();
  const updateWO = useUpdateWorkOrder();
  const isEdit = !!workOrder;
  const isMonteur = role === "monteur";

  const [form, setForm] = useState({
    customer_id: "",
    service_id: "",
    asset_id: "",
    assigned_to: "",
    status: "open",
    description: "",
    remarks: "",
    travel_cost: 0,
  });

  useEffect(() => {
    if (workOrder) {
      setForm({
        customer_id: workOrder.customer_id,
        service_id: workOrder.service_id || "",
        asset_id: (workOrder as any).asset_id || "",
        assigned_to: (workOrder as any).assigned_to || "",
        status: workOrder.status,
        description: (workOrder as any).description || "",
        remarks: workOrder.remarks || "",
        travel_cost: workOrder.travel_cost ?? 0,
      });
    } else {
      setForm({
        customer_id: "",
        service_id: "",
        asset_id: "",
        assigned_to: isMonteur ? (user?.id ?? "") : "",
        status: "open",
        description: "",
        remarks: "",
        travel_cost: 0,
      });
    }
  }, [workOrder, open, isMonteur, user?.id]);

  const set = (key: string, value: unknown) => setForm((f) => ({ ...f, [key]: value }));

  const selectedService = services?.find((s) => s.id === form.service_id);

  const customerAssets = useMemo(() => {
    if (!allAssets || !form.customer_id) return [];
    return allAssets.filter((a) => a.customer_id === form.customer_id && a.status === "actief");
  }, [allAssets, form.customer_id]);

  const groupedServices = useMemo(() => {
    if (!services) return {};
    const groups: Record<string, typeof services> = {};
    for (const s of services) {
      const cat = (s as any).category || "Overig";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(s);
    }
    return groups;
  }, [services]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      customer_id: form.customer_id,
      service_id: form.service_id || null,
      asset_id: form.asset_id || null,
      assigned_to: form.assigned_to || null,
      status: form.status,
      description: form.description || null,
      remarks: form.remarks || null,
      travel_cost: form.travel_cost,
      total_amount: (selectedService?.price ?? 0) + form.travel_cost,
    };

    try {
      if (isEdit) {
        await updateWO.mutateAsync({ id: workOrder!.id, ...payload });
        toast({ title: "Werkbon bijgewerkt" });
      } else {
        await createWO.mutateAsync(payload as any);
        toast({ title: "Werkbon aangemaakt" });
      }
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  const loading = createWO.isPending || updateWO.isPending;

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 pt-0 sm:p-0">
      <div className="space-y-1.5">
        <Label>Klant *</Label>
        <CustomerCombobox
          customers={customers}
          value={form.customer_id}
          onValueChange={(v) => set("customer_id", v)}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Dienst</Label>
        <Select value={form.service_id} onValueChange={(v) => set("service_id", v)}>
          <SelectTrigger><SelectValue placeholder="Kies dienst" /></SelectTrigger>
          <SelectContent>
            {Object.entries(groupedServices).map(([category, items]) => (
              <SelectGroup key={category}>
                <SelectLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">{category}</SelectLabel>
                {items.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name} — €{s.price.toFixed(2)} incl.</SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>
      {customerAssets.length > 0 && (
        <div className="space-y-1.5">
          <Label>Object</Label>
          <Select value={form.asset_id} onValueChange={(v) => set("asset_id", v)}>
            <SelectTrigger><SelectValue placeholder="Kies object (optioneel)" /></SelectTrigger>
            <SelectContent>
              {customerAssets.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}{a.brand ? ` — ${a.brand}` : ""}{a.serial_number ? ` (${a.serial_number})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {/* Toegewezen aan - alleen zichtbaar voor admins */}
      {isAdmin && teamMembers && teamMembers.length > 1 && (
        <div className="space-y-1.5">
          <Label>Toegewezen aan</Label>
          <Select value={form.assigned_to} onValueChange={(v) => set("assigned_to", v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Niet toegewezen" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Niet toegewezen</SelectItem>
              {teamMembers.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.full_name ?? "Onbekend"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-1.5">
        <Label>Status</Label>
        <Select value={form.status} onValueChange={(v) => set("status", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="bezig">Bezig</SelectItem>
            <SelectItem value="afgerond">Afgerond</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Voorrijkosten (€)</Label>
        <Input type="number" value={form.travel_cost} onChange={(e) => set("travel_cost", parseFloat(e.target.value) || 0)} min={0} step={5} />
      </div>
      <div className="space-y-1.5">
        <Label>Werkzaamheden</Label>
        <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} placeholder="Beschrijf wat er gedaan moet worden..." />
      </div>
      <div className="space-y-1.5">
        <Label>Opmerkingen</Label>
        <Textarea value={form.remarks} onChange={(e) => set("remarks", e.target.value)} rows={2} placeholder="Eventuele opmerkingen..." />
      </div>
      {selectedService && (
        <div className="bg-background rounded-sm p-3 text-[13px]">
          <div className="flex justify-between"><span>Dienst (incl. BTW)</span><strong>€{selectedService.price.toFixed(2)}</strong></div>
          <div className="flex justify-between text-t3"><span>Voorrijkosten</span><span>€{form.travel_cost.toFixed(2)}</span></div>
          <div className="flex justify-between pt-1 font-bold text-primary border-t border-border mt-1"><span>Totaal incl. BTW</span><span>€{(selectedService.price + form.travel_cost).toFixed(2)}</span></div>
        </div>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
        <Button type="submit" disabled={loading || !form.customer_id}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEdit ? "Opslaan" : "Aanmaken"}
        </Button>
      </div>
    </form>
  );

  const title = isEdit ? "Werkbon bewerken" : "Nieuwe werkbon";

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-0 pb-4">
            {formContent}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  );
};

export default WorkOrderDialog;
