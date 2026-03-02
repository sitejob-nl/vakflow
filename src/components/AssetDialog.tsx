import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCustomers } from "@/hooks/useCustomers";
import { useAddresses } from "@/hooks/useAddresses";
import type { Asset } from "@/hooks/useAssets";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset?: Asset | null;
  onSave: (data: Partial<Asset>) => void;
  saving?: boolean;
}

const STATUSES = ["actief", "inactief", "buiten dienst", "afgevoerd"];

const AssetDialog = ({ open, onOpenChange, asset, onSave, saving }: Props) => {
  const { data: customers } = useCustomers();
  const [form, setForm] = useState<Partial<Asset>>({});
  const customerId = form.customer_id || "";
  const { data: addresses } = useAddresses(customerId || undefined);

  useEffect(() => {
    if (open) {
      setForm(asset ? { ...asset } : { status: "actief" });
    }
  }, [open, asset]);

  const set = (key: string, val: any) => setForm((p) => ({ ...p, [key]: val || null }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{asset ? "Object bewerken" : "Nieuw object"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Naam *</Label>
            <Input value={form.name || ""} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Input value={form.asset_type || ""} onChange={(e) => set("asset_type", e.target.value)} placeholder="bv. CV-ketel, airco" />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status || "actief"} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Merk</Label>
              <Input value={form.brand || ""} onChange={(e) => set("brand", e.target.value)} />
            </div>
            <div>
              <Label>Model</Label>
              <Input value={form.model || ""} onChange={(e) => set("model", e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Serienummer</Label>
            <Input value={form.serial_number || ""} onChange={(e) => set("serial_number", e.target.value)} />
          </div>
          <div>
            <Label>Klant</Label>
            <Select value={form.customer_id || "__none"} onValueChange={(v) => { set("customer_id", v === "__none" ? null : v); set("address_id", null); }}>
              <SelectTrigger><SelectValue placeholder="Selecteer klant" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Geen klant</SelectItem>
                {customers?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {customerId && addresses && addresses.length > 0 && (
            <div>
              <Label>Adres</Label>
              <Select value={form.address_id || "__none"} onValueChange={(v) => set("address_id", v === "__none" ? null : v)}>
                <SelectTrigger><SelectValue placeholder="Selecteer adres" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Geen adres</SelectItem>
                  {addresses.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {[a.street, a.house_number, a.city].filter(Boolean).join(" ") || "Adres"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Installatiedatum</Label>
              <Input type="date" value={form.install_date || ""} onChange={(e) => set("install_date", e.target.value)} />
            </div>
            <div>
              <Label>Volgende onderhoud</Label>
              <Input type="date" value={form.next_maintenance_date || ""} onChange={(e) => set("next_maintenance_date", e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Notities</Label>
            <Textarea value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
          <Button onClick={() => onSave(form)} disabled={!form.name || saving}>
            {saving ? "Opslaan..." : "Opslaan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AssetDialog;
