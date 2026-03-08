import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CustomerCombobox from "./CustomerCombobox";
import { useCustomers } from "@/hooks/useCustomers";
import { DAMAGE_AREAS, type DamageItem, type TradeVehicle } from "@/hooks/useTradeVehicles";
import { Car, ClipboardCheck, DollarSign } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  vehicle?: TradeVehicle | null;
  onSave: (data: any) => void;
}

const severityColors: Record<string, string> = {
  geen: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  licht: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  matig: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  zwaar: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export const TradeVehicleDialog = ({ open, onOpenChange, vehicle, onSave }: Props) => {
  const [form, setForm] = useState({
    license_plate: "",
    brand: "",
    model: "",
    year: new Date().getFullYear(),
    mileage: 0,
    color: "",
    fuel_type: "benzine",
    transmission: "handgeschakeld",
    vin: "",
    general_notes: "",
    condition_score: 7,
    purchase_price: 0,
    estimated_repair_cost: 0,
    target_sell_price: 0,
    actual_sell_price: null as number | null,
    status: "intake",
    purchased_from_customer_id: null as string | null,
    sold_to_customer_id: null as string | null,
  });

  const [damageChecklist, setDamageChecklist] = useState<DamageItem[]>(
    DAMAGE_AREAS.map(area => ({ area, severity: "geen" as const, description: "" }))
  );

  useEffect(() => {
    if (vehicle) {
      setForm({
        license_plate: vehicle.license_plate || "",
        brand: vehicle.brand || "",
        model: vehicle.model || "",
        year: vehicle.year || new Date().getFullYear(),
        mileage: vehicle.mileage || 0,
        color: vehicle.color || "",
        fuel_type: vehicle.fuel_type || "benzine",
        transmission: vehicle.transmission || "handgeschakeld",
        vin: vehicle.vin || "",
        general_notes: vehicle.general_notes || "",
        condition_score: vehicle.condition_score || 7,
        purchase_price: vehicle.purchase_price,
        estimated_repair_cost: vehicle.estimated_repair_cost,
        target_sell_price: vehicle.target_sell_price,
        actual_sell_price: vehicle.actual_sell_price,
        status: vehicle.status,
        purchased_from_customer_id: vehicle.purchased_from_customer_id,
        sold_to_customer_id: vehicle.sold_to_customer_id,
      });
      setDamageChecklist(
        vehicle.damage_checklist.length > 0
          ? vehicle.damage_checklist
          : DAMAGE_AREAS.map(area => ({ area, severity: "geen" as const, description: "" }))
      );
    } else {
      setForm({
        license_plate: "", brand: "", model: "", year: new Date().getFullYear(),
        mileage: 0, color: "", fuel_type: "benzine", transmission: "handgeschakeld",
        vin: "", general_notes: "", condition_score: 7,
        purchase_price: 0, estimated_repair_cost: 0, target_sell_price: 0,
        actual_sell_price: null, status: "intake",
        purchased_from_customer_id: null, sold_to_customer_id: null,
      });
      setDamageChecklist(DAMAGE_AREAS.map(area => ({ area, severity: "geen" as const, description: "" })));
    }
  }, [vehicle, open]);

  const updateDamage = (index: number, field: keyof DamageItem, value: string) => {
    setDamageChecklist(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const expectedMargin = form.target_sell_price - form.purchase_price - form.estimated_repair_cost;

  const handleSubmit = () => {
    onSave({
      ...(vehicle?.id ? { id: vehicle.id } : {}),
      ...form,
      damage_checklist: damageChecklist,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{vehicle ? "Inruilvoertuig bewerken" : "Nieuw inruilvoertuig"}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="vehicle" className="mt-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="vehicle" className="gap-1.5"><Car className="h-4 w-4" /> Voertuig</TabsTrigger>
            <TabsTrigger value="appraisal" className="gap-1.5"><ClipboardCheck className="h-4 w-4" /> Taxatie</TabsTrigger>
            <TabsTrigger value="pricing" className="gap-1.5"><DollarSign className="h-4 w-4" /> Prijzen</TabsTrigger>
          </TabsList>

          {/* Vehicle info tab */}
          <TabsContent value="vehicle" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Kenteken</Label>
                <Input value={form.license_plate} onChange={e => setForm(f => ({ ...f, license_plate: e.target.value.toUpperCase() }))} placeholder="AB-123-CD" />
              </div>
              <div>
                <Label>VIN</Label>
                <Input value={form.vin} onChange={e => setForm(f => ({ ...f, vin: e.target.value }))} />
              </div>
              <div>
                <Label>Merk</Label>
                <Input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} />
              </div>
              <div>
                <Label>Model</Label>
                <Input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} />
              </div>
              <div>
                <Label>Bouwjaar</Label>
                <Input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: +e.target.value }))} />
              </div>
              <div>
                <Label>Kilometerstand</Label>
                <Input type="number" value={form.mileage} onChange={e => setForm(f => ({ ...f, mileage: +e.target.value }))} />
              </div>
              <div>
                <Label>Kleur</Label>
                <Input value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} />
              </div>
              <div>
                <Label>Brandstof</Label>
                <Select value={form.fuel_type} onValueChange={v => setForm(f => ({ ...f, fuel_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["benzine", "diesel", "elektrisch", "hybride", "lpg"].map(f => (
                      <SelectItem key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Transmissie</Label>
                <Select value={form.transmission} onValueChange={v => setForm(f => ({ ...f, transmission: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="handgeschakeld">Handgeschakeld</SelectItem>
                    <SelectItem value="automaat">Automaat</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="intake">Intake</SelectItem>
                    <SelectItem value="in_opknapbeurt">In opknapbeurt</SelectItem>
                    <SelectItem value="te_koop">Te koop</SelectItem>
                    <SelectItem value="verkocht">Verkocht</SelectItem>
                    <SelectItem value="afgekeurd">Afgekeurd</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Ingeruild door (klant)</Label>
              <CustomerCombobox value={form.purchased_from_customer_id} onChange={v => setForm(f => ({ ...f, purchased_from_customer_id: v }))} />
            </div>
            {form.status === "verkocht" && (
              <div>
                <Label>Verkocht aan (klant)</Label>
                <CustomerCombobox value={form.sold_to_customer_id} onChange={v => setForm(f => ({ ...f, sold_to_customer_id: v }))} />
              </div>
            )}
          </TabsContent>

          {/* Appraisal / Damage Checklist tab */}
          <TabsContent value="appraisal" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Conditie score (1-10)</Label>
                <Input type="number" min={1} max={10} value={form.condition_score} onChange={e => setForm(f => ({ ...f, condition_score: +e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Schade-checklist</Label>
              <div className="space-y-2 max-h-[400px] overflow-y-auto border rounded-md p-3">
                {damageChecklist.map((item, idx) => (
                  <div key={item.area} className="flex items-start gap-3 py-2 border-b last:border-b-0">
                    <span className="text-sm font-medium w-40 shrink-0 pt-1">{item.area}</span>
                    <div className="flex gap-1">
                      {(["geen", "licht", "matig", "zwaar"] as const).map(sev => (
                        <button
                          key={sev}
                          type="button"
                          onClick={() => updateDamage(idx, "severity", sev)}
                          className={`px-2 py-0.5 rounded-full text-xs font-medium transition-all ${
                            item.severity === sev ? severityColors[sev] : "bg-muted text-muted-foreground opacity-50 hover:opacity-75"
                          }`}
                        >
                          {sev}
                        </button>
                      ))}
                    </div>
                    {item.severity !== "geen" && (
                      <Input
                        className="h-8 text-sm flex-1"
                        placeholder="Beschrijving schade..."
                        value={item.description}
                        onChange={e => updateDamage(idx, "description", e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Label>Algemene opmerkingen</Label>
              <Textarea value={form.general_notes} onChange={e => setForm(f => ({ ...f, general_notes: e.target.value }))} rows={3} />
            </div>
          </TabsContent>

          {/* Pricing tab */}
          <TabsContent value="pricing" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Inkoopprijs (€)</Label>
                <Input type="number" step="0.01" value={form.purchase_price} onChange={e => setForm(f => ({ ...f, purchase_price: +e.target.value }))} />
              </div>
              <div>
                <Label>Geschatte opknapkosten (€)</Label>
                <Input type="number" step="0.01" value={form.estimated_repair_cost} onChange={e => setForm(f => ({ ...f, estimated_repair_cost: +e.target.value }))} />
              </div>
              <div>
                <Label>Streefverkoopprijs (€)</Label>
                <Input type="number" step="0.01" value={form.target_sell_price} onChange={e => setForm(f => ({ ...f, target_sell_price: +e.target.value }))} />
              </div>
              {form.status === "verkocht" && (
                <div>
                  <Label>Werkelijke verkoopprijs (€)</Label>
                  <Input type="number" step="0.01" value={form.actual_sell_price ?? ""} onChange={e => setForm(f => ({ ...f, actual_sell_price: e.target.value ? +e.target.value : null }))} />
                </div>
              )}
            </div>
            <div className="rounded-lg border p-4 bg-muted/50 space-y-2">
              <h4 className="font-semibold text-sm">Margeberekening</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Totale investering:</span>
                <span className="font-medium">€ {(form.purchase_price + form.estimated_repair_cost).toFixed(2)}</span>
                <span className="text-muted-foreground">Verwachte marge:</span>
                <span className={`font-bold ${expectedMargin >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  € {expectedMargin.toFixed(2)}
                </span>
                {form.actual_sell_price != null && (
                  <>
                    <span className="text-muted-foreground">Werkelijke marge:</span>
                    <span className={`font-bold ${(form.actual_sell_price - form.purchase_price - form.estimated_repair_cost) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      € {(form.actual_sell_price - form.purchase_price - form.estimated_repair_cost).toFixed(2)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
          <Button onClick={handleSubmit}>{vehicle ? "Opslaan" : "Toevoegen"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
