import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import CustomerCombobox from "@/components/CustomerCombobox";
import { Loader2, Search } from "lucide-react";
import { useCreateVehicle, useUpdateVehicle, useRdwLookup, type Vehicle } from "@/hooks/useVehicles";
import { useCustomers } from "@/hooks/useCustomers";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle?: Vehicle | null;
  defaultCustomerId?: string;
}

const VehicleDialog = ({ open, onOpenChange, vehicle, defaultCustomerId }: Props) => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { data: customers } = useCustomers();
  const createVehicle = useCreateVehicle();
  const updateVehicle = useUpdateVehicle();
  const rdwLookup = useRdwLookup();
  const isEdit = !!vehicle;

  const [form, setForm] = useState({
    license_plate: "",
    customer_id: "",
    vin: "",
    brand: "",
    model: "",
    build_year: "",
    fuel_type: "",
    color: "",
    apk_expiry_date: "",
    registration_date: "",
    vehicle_mass: "",
    mileage_current: "",
    notes: "",
    status: "actief",
  });

  useEffect(() => {
    if (vehicle) {
      setForm({
        license_plate: vehicle.license_plate || "",
        customer_id: vehicle.customer_id || "",
        vin: vehicle.vin || "",
        brand: vehicle.brand || "",
        model: vehicle.model || "",
        build_year: vehicle.build_year?.toString() || "",
        fuel_type: vehicle.fuel_type || "",
        color: vehicle.color || "",
        apk_expiry_date: vehicle.apk_expiry_date || "",
        registration_date: vehicle.registration_date || "",
        vehicle_mass: vehicle.vehicle_mass?.toString() || "",
        mileage_current: vehicle.mileage_current?.toString() || "",
        notes: vehicle.notes || "",
        status: vehicle.status,
      });
    } else {
      setForm({
        license_plate: "",
        customer_id: defaultCustomerId || "",
        vin: "",
        brand: "",
        model: "",
        build_year: "",
        fuel_type: "",
        color: "",
        apk_expiry_date: "",
        registration_date: "",
        vehicle_mass: "",
        mileage_current: "",
        notes: "",
        status: "actief",
      });
    }
  }, [vehicle, open, defaultCustomerId]);

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleRdwLookup = async () => {
    if (!form.license_plate) return;
    try {
      const result = await rdwLookup.mutateAsync(form.license_plate);
      if (result.found) {
        setForm((f) => ({
          ...f,
          license_plate: result.plate || f.license_plate,
          brand: result.brand || f.brand,
          model: result.model || f.model,
          build_year: result.build_year?.toString() || f.build_year,
          fuel_type: result.fuel_type || f.fuel_type,
          color: result.color || f.color,
          vehicle_mass: result.vehicle_mass?.toString() || f.vehicle_mass,
          registration_date: result.registration_date || f.registration_date,
          apk_expiry_date: result.apk_expiry_date || f.apk_expiry_date,
        }));
        toast({ title: "RDW gegevens opgehaald", description: `${result.brand} ${result.model}` });
      } else {
        toast({ title: "Niet gevonden", description: "Geen voertuig gevonden bij dit kenteken", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "RDW lookup mislukt", description: err.message, variant: "destructive" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      license_plate: form.license_plate.replace(/[\s-]/g, "").toUpperCase(),
      customer_id: form.customer_id || null,
      vin: form.vin || null,
      brand: form.brand || null,
      model: form.model || null,
      build_year: form.build_year ? parseInt(form.build_year) : null,
      fuel_type: form.fuel_type || null,
      color: form.color || null,
      apk_expiry_date: form.apk_expiry_date || null,
      registration_date: form.registration_date || null,
      vehicle_mass: form.vehicle_mass ? parseInt(form.vehicle_mass) : null,
      mileage_current: form.mileage_current ? parseInt(form.mileage_current) : 0,
      notes: form.notes || null,
      status: form.status,
    };

    try {
      if (isEdit) {
        await updateVehicle.mutateAsync({ id: vehicle!.id, ...payload });
        toast({ title: "Voertuig bijgewerkt" });
      } else {
        await createVehicle.mutateAsync(payload);
        toast({ title: "Voertuig aangemaakt" });
      }
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  const loading = createVehicle.isPending || updateVehicle.isPending;

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 pt-0 sm:p-0">
      {/* Kenteken + RDW lookup */}
      <div className="space-y-1.5">
        <Label>Kenteken *</Label>
        <div className="flex gap-2">
          <Input
            value={form.license_plate}
            onChange={(e) => set("license_plate", e.target.value.toUpperCase())}
            placeholder="AB-123-CD"
            className="font-mono tracking-wider uppercase"
            required
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleRdwLookup}
            disabled={rdwLookup.isPending || !form.license_plate}
            title="RDW opzoeken"
          >
            {rdwLookup.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Klant</Label>
        <CustomerCombobox
          customers={customers}
          value={form.customer_id}
          onValueChange={(v) => set("customer_id", v)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Merk</Label>
          <Input value={form.brand} onChange={(e) => set("brand", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Model</Label>
          <Input value={form.model} onChange={(e) => set("model", e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>Bouwjaar</Label>
          <Input type="number" value={form.build_year} onChange={(e) => set("build_year", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Brandstof</Label>
          <Input value={form.fuel_type} onChange={(e) => set("fuel_type", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Kleur</Label>
          <Input value={form.color} onChange={(e) => set("color", e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>APK vervaldatum</Label>
          <Input type="date" value={form.apk_expiry_date} onChange={(e) => set("apk_expiry_date", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>KM-stand</Label>
          <Input type="number" value={form.mileage_current} onChange={(e) => set("mileage_current", e.target.value)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>VIN / Chassisnummer</Label>
        <Input value={form.vin} onChange={(e) => set("vin", e.target.value)} className="font-mono" />
      </div>

      <div className="space-y-1.5">
        <Label>Opmerkingen</Label>
        <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
        <Button type="submit" disabled={loading || !form.license_plate}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEdit ? "Opslaan" : "Aanmaken"}
        </Button>
      </div>
    </form>
  );

  const title = isEdit ? "Voertuig bewerken" : "Nieuw voertuig";

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader><DrawerTitle>{title}</DrawerTitle></DrawerHeader>
          <div className="overflow-y-auto px-0 pb-4">{formContent}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  );
};

export default VehicleDialog;
