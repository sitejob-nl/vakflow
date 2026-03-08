import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import CustomerCombobox from "@/components/CustomerCombobox";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Wrench, Sparkles } from "lucide-react";
import AiIntakePanel from "@/components/AiIntakePanel";
import type { AiIntakeSuggestion } from "@/hooks/useAiIntake";
import { useCreateWorkOrder, useUpdateWorkOrder } from "@/hooks/useWorkOrders";
import { useAddWorkOrderMaterial, useMaterials } from "@/hooks/useMaterials";
import { useCustomers } from "@/hooks/useCustomers";
import { useServices } from "@/hooks/useCustomers";
import { useAssets, useObjectRooms, useFleetVehicleTypes } from "@/hooks/useAssets";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useCustomerVehicles, useWorkshopBays } from "@/hooks/useVehicles";
import { useAutoBayAssignment } from "@/hooks/useAutoBayAssignment";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useIndustryConfig } from "@/hooks/useIndustryConfig";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workOrder?: Tables<"work_orders"> | null;
}

const WorkOrderDialog = ({ open, onOpenChange, workOrder }: Props) => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { labels, industry } = useIndustryConfig();
  const isAutomotive = industry === "automotive";
  const isCleaning = industry === "cleaning";
  const { isAdmin, user, role } = useAuth();
  const { data: customers } = useCustomers();
  const { data: services } = useServices();
  const { data: allAssets } = useAssets();
  const { data: teamMembers } = useTeamMembers();
  const createWO = useCreateWorkOrder();
  const updateWO = useUpdateWorkOrder();
  const isEdit = !!workOrder;
  const isMonteur = role === "monteur";
  const [showAiIntake, setShowAiIntake] = useState(false);
  const [aiMaterials, setAiMaterials] = useState<any[] | null>(null);

  const handleAiApply = (s: AiIntakeSuggestion) => {
    setForm((f) => ({
      ...f,
      description: s.summary + (s.notes ? `\n\n${s.notes}` : ""),
      work_order_type: s.work_order_type || f.work_order_type,
      service_id: s.suggested_service_id || f.service_id,
    }));
    setShowAiIntake(false);
    setAiMaterials(s.suggested_materials ?? null);
  };

  const [form, setForm] = useState({
    customer_id: "",
    service_id: "",
    asset_id: "",
    assigned_to: "",
    status: "open",
    description: "",
    remarks: "",
    travel_cost: 0,
    vehicle_id: "",
    work_order_type: "",
    mileage_start: "",
    mileage_end: "",
  });

  // Cleaning-specific state
  const [vehiclesWashed, setVehiclesWashed] = useState<Record<string, number>>({});
  const [roomChecklist, setRoomChecklist] = useState<Record<string, Record<string, boolean>>>({});

  // Vehicles for selected customer (automotive)
  const { data: customerVehicles } = useCustomerVehicles(isAutomotive && form.customer_id ? form.customer_id : undefined);

  // Get selected asset details for cleaning
  const selectedAsset = useMemo(() => {
    if (!allAssets || !form.asset_id) return null;
    return allAssets.find((a) => a.id === form.asset_id) ?? null;
  }, [allAssets, form.asset_id]);

  const isFleet = isCleaning && selectedAsset?.object_type === "fleet";
  const isBuilding = isCleaning && selectedAsset?.object_type === "building";

  // Fetch fleet vehicle types or object rooms for cleaning
  const { data: fleetTypes } = useFleetVehicleTypes(isFleet ? form.asset_id : undefined);
  const { data: objectRooms } = useObjectRooms(isBuilding ? form.asset_id : undefined);

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
        vehicle_id: (workOrder as any).vehicle_id || "",
        work_order_type: (workOrder as any).work_order_type || "",
        mileage_start: (workOrder as any).mileage_start?.toString() || "",
        mileage_end: (workOrder as any).mileage_end?.toString() || "",
      });
      // Restore cleaning data if editing
      if ((workOrder as any).vehicles_washed) {
        try {
          const vw = typeof (workOrder as any).vehicles_washed === "string"
            ? JSON.parse((workOrder as any).vehicles_washed)
            : (workOrder as any).vehicles_washed;
          if (Array.isArray(vw)) {
            const map: Record<string, number> = {};
            vw.forEach((v: any) => { if (v.type && v.count != null) map[v.type] = v.count; });
            setVehiclesWashed(map);
          }
        } catch { /* ignore */ }
      }
      if ((workOrder as any).room_checklists) {
        try {
          const rc = typeof (workOrder as any).room_checklists === "string"
            ? JSON.parse((workOrder as any).room_checklists)
            : (workOrder as any).room_checklists;
          if (rc && typeof rc === "object") setRoomChecklist(rc);
        } catch { /* ignore */ }
      }
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
        vehicle_id: "",
        work_order_type: "",
        mileage_start: "",
        mileage_end: "",
      });
      setVehiclesWashed({});
      setRoomChecklist({});
      setAiMaterials(null);
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

  // Auto bay assignment for automotive
  const { suggestion: suggestedBay, activeBays: availableBays } = useAutoBayAssignment(
    isAutomotive && !isEdit ? new Date() : undefined
  );

  // Calculate vehicles washed total
  const vehiclesWashedTotal = useMemo(() => {
    return Object.values(vehiclesWashed).reduce((sum, c) => sum + (c || 0), 0);
  }, [vehiclesWashed]);

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
      ...(isAutomotive ? {
        vehicle_id: form.vehicle_id || null,
        work_order_type: form.work_order_type || null,
        mileage_start: form.mileage_start ? parseInt(form.mileage_start) : null,
        mileage_end: form.mileage_end ? parseInt(form.mileage_end) : null,
        ...(!isEdit && suggestedBay ? { bay_id: suggestedBay.id } : {}),
      } : {}),
      // Cleaning-specific fields
      ...(isCleaning && isFleet ? {
        vehicles_washed: Object.entries(vehiclesWashed)
          .filter(([, count]) => count > 0)
          .map(([type, count]) => ({ type, count })),
        vehicles_washed_total: vehiclesWashedTotal,
      } : {}),
      ...(isCleaning && isBuilding && Object.keys(roomChecklist).length > 0 ? {
        room_checklists: roomChecklist,
      } : {}),
    };

    try {
      if (isEdit) {
        await updateWO.mutateAsync({ id: workOrder!.id, ...payload });
        toast({ title: `${labels.workOrder} bijgewerkt` });
      } else {
        await createWO.mutateAsync(payload as any);
        toast({ title: `${labels.workOrder} aangemaakt` });
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
      {/* Automotive: vehicle selector + type + mileage */}
      {isAutomotive && (
        <>
          <div className="space-y-1.5">
            <Label>Voertuig</Label>
            <Select value={form.vehicle_id} onValueChange={(v) => set("vehicle_id", v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Kies voertuig (kenteken)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Geen voertuig</SelectItem>
                {(customerVehicles ?? []).map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.license_plate} — {v.brand} {v.model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Type werkorder</Label>
            <Select value={form.work_order_type} onValueChange={(v) => set("work_order_type", v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Kies type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Niet gespecificeerd</SelectItem>
                <SelectItem value="apk">APK</SelectItem>
                <SelectItem value="kleine_beurt">Kleine beurt</SelectItem>
                <SelectItem value="grote_beurt">Grote beurt</SelectItem>
                <SelectItem value="storing">Storing / reparatie</SelectItem>
                <SelectItem value="bandenwissel">Bandenwissel</SelectItem>
                <SelectItem value="aflevering">Aflevering</SelectItem>
                <SelectItem value="overig">Overig</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>KM-stand begin</Label>
              <Input type="number" value={form.mileage_start} onChange={(e) => set("mileage_start", e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>KM-stand eind</Label>
              <Input type="number" value={form.mileage_end} onChange={(e) => set("mileage_end", e.target.value)} placeholder="0" />
            </div>
          </div>
        </>
      )}
      {/* Auto bay assignment info for automotive */}
      {isAutomotive && !isEdit && suggestedBay && (
        <div className="flex items-center gap-2 text-[12px] bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
          <Wrench className="h-3.5 w-3.5 text-primary flex-shrink-0" />
          <span>
            Auto-brug: <strong>{suggestedBay.name}</strong>
            <span className="text-muted-foreground ml-1">(minste belasting)</span>
          </span>
        </div>
      )}
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

      {/* Cleaning: Fleet vehicle wash counts */}
      {isFleet && fleetTypes && fleetTypes.length > 0 && (
        <div className="space-y-2 border border-border rounded-lg p-3 bg-muted/30">
          <Label className="text-[13px] font-bold">Gewassen voertuigen</Label>
          <div className="space-y-2">
            {fleetTypes.map((ft) => (
              <div key={ft.id} className="flex items-center justify-between gap-3">
                <span className="text-[13px]">{ft.vehicle_type} <span className="text-muted-foreground">({ft.count} in park)</span></span>
                <Input
                  type="number"
                  min={0}
                  max={ft.count}
                  className="w-20 h-8 text-center"
                  value={vehiclesWashed[ft.vehicle_type] ?? ""}
                  onChange={(e) => setVehiclesWashed((prev) => ({
                    ...prev,
                    [ft.vehicle_type]: parseInt(e.target.value) || 0,
                  }))}
                  placeholder="0"
                />
              </div>
            ))}
          </div>
          {vehiclesWashedTotal > 0 && (
            <p className="text-[12px] font-semibold text-primary">Totaal: {vehiclesWashedTotal} voertuig(en)</p>
          )}
        </div>
      )}

      {/* Cleaning: Building room checklists */}
      {isBuilding && objectRooms && objectRooms.length > 0 && (
        <div className="space-y-3 border border-border rounded-lg p-3 bg-muted/30">
          <Label className="text-[13px] font-bold">Ruimte-checklist</Label>
          {objectRooms.map((room) => {
            const checklist = Array.isArray(room.checklist) ? room.checklist : [];
            if (checklist.length === 0) return null;
            return (
              <div key={room.id} className="space-y-1.5">
                <p className="text-[12px] font-semibold text-foreground">{room.name}</p>
                <div className="space-y-1 ml-1">
                  {checklist.map((item: any, idx: number) => {
                    const itemLabel = typeof item === "string" ? item : item.label || item.name || `Item ${idx + 1}`;
                    const checked = roomChecklist[room.id]?.[itemLabel] ?? false;
                    return (
                      <label key={idx} className="flex items-center gap-2 text-[12px] cursor-pointer">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(val) => {
                            setRoomChecklist((prev) => ({
                              ...prev,
                              [room.id]: {
                                ...(prev[room.id] || {}),
                                [itemLabel]: !!val,
                              },
                            }));
                          }}
                        />
                        <span>{itemLabel}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
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
      {/* AI Intake */}
      {!isEdit && (
        showAiIntake ? (
          <AiIntakePanel onApply={handleAiApply} onClose={() => setShowAiIntake(false)} />
        ) : (
          <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setShowAiIntake(true)}>
            <Sparkles className="mr-1.5 h-3.5 w-3.5" /> AI Intake — klacht analyseren
          </Button>
        )
      )}
      {/* AI material suggestions */}
      {aiMaterials && aiMaterials.length > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-[12px]">
          <p className="font-semibold text-primary mb-1">AI-suggestie materialen:</p>
          <ul className="list-disc list-inside text-muted-foreground">
            {aiMaterials.map((m: any, i: number) => (
              <li key={i}>{m.name || m}{m.quantity ? ` (${m.quantity}x)` : ""}</li>
            ))}
          </ul>
        </div>
      )}
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

  const title = isEdit ? `${labels.workOrder} bewerken` : `Nieuwe ${labels.workOrder.toLowerCase()}`;

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
