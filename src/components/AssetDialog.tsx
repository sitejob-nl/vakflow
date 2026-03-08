import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCustomers } from "@/hooks/useCustomers";
import { useAddresses } from "@/hooks/useAddresses";
import { useIndustryConfig } from "@/hooks/useIndustryConfig";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Truck } from "lucide-react";
import type { Asset } from "@/hooks/useAssets";

interface FieldDef {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "boolean";
  options?: string[];
  required?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset?: Asset | null;
  onSave: (data: Partial<Asset>) => void;
  saving?: boolean;
}

const STATUSES = ["actief", "inactief", "buiten dienst", "afgevoerd"];
const FREQUENCIES = [
  { value: "daily", label: "Dagelijks" },
  { value: "2x_week", label: "2x per week" },
  { value: "3x_week", label: "3x per week" },
  { value: "weekly", label: "Wekelijks" },
  { value: "biweekly", label: "2-wekelijks" },
  { value: "monthly", label: "Maandelijks" },
  { value: "quarterly", label: "Per kwartaal" },
  { value: "yearly", label: "Jaarlijks" },
];
const WEEKDAYS = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];
const FACILITY_OPTIONS = ["water", "stroom", "overdekt", "perslucht"];

const AssetDialog = ({ open, onOpenChange, asset, onSave, saving }: Props) => {
  const { data: customers } = useCustomers();
  const { industry } = useIndustryConfig();
  const { companyId } = useAuth();
  const isCleaning = industry === "cleaning";
  const [form, setForm] = useState<Partial<Asset>>({});
  const customerId = form.customer_id || "";
  const { data: addresses } = useAddresses(customerId || undefined);

  const { data: fieldConfig } = useQuery({
    queryKey: ["asset_field_config", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select("asset_field_config")
        .eq("id", companyId!)
        .single();
      return (data?.asset_field_config as FieldDef[] | null) ?? [];
    },
    enabled: !!companyId,
  });

  const setCustomField = (key: string, value: any) => {
    setForm((prev) => ({
      ...prev,
      custom_fields: { ...(prev.custom_fields || {}), [key]: value },
    }));
  };

  useEffect(() => {
    if (open) {
      setForm(asset ? { ...asset } : { status: "actief", object_type: "building", frequency: "weekly" });
    }
  }, [open, asset]);

  const set = (key: string, val: any) => setForm((p) => ({ ...p, [key]: val ?? null }));

  const toggleDay = (day: number) => {
    const current = form.frequency_days || [];
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort();
    set("frequency_days", next.length > 0 ? next : null);
  };

  const toggleFacility = (fac: string) => {
    const current = form.facilities || [];
    const next = current.includes(fac) ? current.filter((f) => f !== fac) : [...current, fac];
    set("facilities", next.length > 0 ? next : null);
  };

  const isBuilding = form.object_type !== "fleet";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{asset ? "Object bewerken" : "Nieuw object"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Object type toggle - only for cleaning */}
          {isCleaning && (
            <div>
              <Label className="mb-1.5 block">Type object</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={isBuilding ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => set("object_type", "building")}
                >
                  <Building2 className="w-4 h-4 mr-1.5" /> Pand
                </Button>
                <Button
                  type="button"
                  variant={!isBuilding ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => set("object_type", "fleet")}
                >
                  <Truck className="w-4 h-4 mr-1.5" /> Wagenpark
                </Button>
              </div>
            </div>
          )}

          <div>
            <Label>Naam *</Label>
            <Input value={form.name || ""} onChange={(e) => set("name", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Input value={form.asset_type || ""} onChange={(e) => set("asset_type", e.target.value)} placeholder={isCleaning ? (isBuilding ? "bv. kantoor, school" : "bv. lease-vloot") : "bv. CV-ketel, airco"} />
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

          {/* Cleaning-specific: frequency */}
          {isCleaning && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Frequentie</Label>
                  <Select value={form.frequency || "weekly"} onValueChange={(v) => set("frequency", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FREQUENCIES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {isBuilding && (
                  <div>
                    <Label>Oppervlakte (m²)</Label>
                    <Input type="number" value={form.surface_area || ""} onChange={(e) => set("surface_area", e.target.value ? parseInt(e.target.value) : null)} />
                  </div>
                )}
                {!isBuilding && (
                  <div>
                    <Label>Aantal voertuigen</Label>
                    <Input type="number" value={form.vehicle_count || ""} onChange={(e) => set("vehicle_count", e.target.value ? parseInt(e.target.value) : null)} />
                  </div>
                )}
              </div>
              <div>
                <Label className="mb-1.5 block">Vaste dagen</Label>
                <div className="flex gap-1.5">
                  {WEEKDAYS.map((day, i) => (
                    <Button
                      key={i}
                      type="button"
                      size="sm"
                      variant={(form.frequency_days || []).includes(i) ? "default" : "outline"}
                      className="w-9 h-9 p-0 text-xs"
                      onClick={() => toggleDay(i)}
                    >
                      {day}
                    </Button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Non-cleaning: brand/model/serial */}
          {!isCleaning && (
            <>
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
            </>
          )}

          {/* Fleet: facilities */}
          {isCleaning && !isBuilding && (
            <div>
              <Label className="mb-1.5 block">Faciliteiten</Label>
              <div className="flex flex-wrap gap-3">
                {FACILITY_OPTIONS.map((fac) => (
                  <label key={fac} className="flex items-center gap-1.5 text-sm">
                    <Checkbox
                      checked={(form.facilities || []).includes(fac)}
                      onCheckedChange={() => toggleFacility(fac)}
                    />
                    {fac.charAt(0).toUpperCase() + fac.slice(1)}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Building: access instructions */}
          {isCleaning && isBuilding && (
            <div>
              <Label>Toegangsinstructies</Label>
              <Textarea value={form.access_instructions || ""} onChange={(e) => set("access_instructions", e.target.value)} rows={2} placeholder="Sleutelnummer, alarm code, etc." />
            </div>
          )}

          {/* Custom fields */}
          {fieldConfig && fieldConfig.length > 0 && (
            <div className="space-y-3 pt-2 border-t">
              <Label className="text-sm font-semibold">Extra velden</Label>
              {fieldConfig.map((fd) => (
                <div key={fd.key}>
                  <Label>{fd.label}{fd.required ? " *" : ""}</Label>
                  {fd.type === "text" && (
                    <Input
                      value={(form.custom_fields as any)?.[fd.key] ?? ""}
                      onChange={(e) => setCustomField(fd.key, e.target.value)}
                    />
                  )}
                  {fd.type === "number" && (
                    <Input
                      type="number"
                      value={(form.custom_fields as any)?.[fd.key] ?? ""}
                      onChange={(e) => setCustomField(fd.key, e.target.value ? Number(e.target.value) : null)}
                    />
                  )}
                  {fd.type === "date" && (
                    <Input
                      type="date"
                      value={(form.custom_fields as any)?.[fd.key] ?? ""}
                      onChange={(e) => setCustomField(fd.key, e.target.value || null)}
                    />
                  )}
                  {fd.type === "select" && (
                    <Select
                      value={(form.custom_fields as any)?.[fd.key] ?? "__none"}
                      onValueChange={(v) => setCustomField(fd.key, v === "__none" ? null : v)}
                    >
                      <SelectTrigger><SelectValue placeholder="Kies..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">—</SelectItem>
                        {(fd.options ?? []).map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {fd.type === "boolean" && (
                    <div className="flex items-center gap-2 mt-1">
                      <Checkbox
                        checked={!!(form.custom_fields as any)?.[fd.key]}
                        onCheckedChange={(checked) => setCustomField(fd.key, !!checked)}
                      />
                      <span className="text-sm">{fd.label}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

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
              <Label>{isCleaning ? "Startdatum" : "Installatiedatum"}</Label>
              <Input type="date" value={form.install_date || ""} onChange={(e) => set("install_date", e.target.value)} />
            </div>
            <div>
              <Label>Laatste beurt</Label>
              <Input type="date" value={form.last_maintenance_date || ""} onChange={(e) => set("last_maintenance_date", e.target.value)} />
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
