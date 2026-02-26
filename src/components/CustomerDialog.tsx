import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { useCreateCustomer, useUpdateCustomer, useServices } from "@/hooks/useCustomers";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";
import AddressAutocomplete from "@/components/AddressAutocomplete";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: Tables<"customers"> | null;
  onCreated?: (customer: Tables<"customers">) => void;
}

const CustomerDialog = ({ open, onOpenChange, customer, onCreated }: Props) => {
  const { toast } = useToast();
  const { data: services } = useServices();
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const isEdit = !!customer;

  const [form, setForm] = useState({
    name: "",
    type: "particulier",
    contact_person: "",
    phone: "",
    email: "",
    address: "",
    postal_code: "",
    city: "",
    lat: null as number | null,
    lng: null as number | null,
    default_service_id: "",
    interval_months: 24,
    whatsapp_optin: false,
    notes: "",
  });

  useEffect(() => {
    if (customer) {
      setForm({
        name: customer.name || "",
        type: customer.type || "particulier",
        contact_person: customer.contact_person || "",
        phone: customer.phone || "",
        email: customer.email || "",
        address: customer.address || "",
        postal_code: customer.postal_code || "",
        city: customer.city || "",
        lat: (customer as any).lat ?? null,
        lng: (customer as any).lng ?? null,
        default_service_id: customer.default_service_id || "",
        interval_months: customer.interval_months ?? 24,
        whatsapp_optin: customer.whatsapp_optin ?? false,
        notes: customer.notes || "",
      });
    } else {
      setForm({
        name: "", type: "particulier", contact_person: "", phone: "", email: "",
        address: "", postal_code: "", city: "", lat: null, lng: null, default_service_id: "",
        interval_months: 24, whatsapp_optin: false, notes: "",
      });
    }
  }, [customer, open]);

  const set = (key: string, value: unknown) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      default_service_id: form.default_service_id || null,
    };

    // Auto-geocode if address is filled but coordinates are missing
    if (payload.lat == null && payload.lng == null && payload.address && payload.city) {
      try {
        const query = [payload.address, payload.postal_code, payload.city].filter(Boolean).join(", ");
        const { data, error } = await supabase.functions.invoke("mapbox-proxy", {
          body: { action: "geocode", query },
        });
        if (!error && data?.[0]) {
          payload.lat = data[0].lat;
          payload.lng = data[0].lng;
        }
      } catch {
        // Continue saving without coordinates if geocoding fails
      }
    }

    try {
      if (isEdit) {
        await updateCustomer.mutateAsync({ id: customer!.id, ...payload });
        toast({ title: "Klant bijgewerkt" });
      } else {
        const newCustomer = await createCustomer.mutateAsync(payload);
        toast({ title: "Klant aangemaakt" });
        onCreated?.(newCustomer);
      }
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  const loading = createCustomer.isPending || updateCustomer.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Klant bewerken" : "Nieuwe klant"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>Naam *</Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} required placeholder="Fam. De Vries" />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => set("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="particulier">Particulier</SelectItem>
                  <SelectItem value="zakelijk">Zakelijk</SelectItem>
                  <SelectItem value="vve">VvE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Contactpersoon</Label>
              <Input value={form.contact_person} onChange={(e) => set("contact_person", e.target.value)} placeholder="Jan de Vries" />
            </div>
            <div className="space-y-1.5">
              <Label>Telefoon</Label>
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="06-1234 5678" />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="jan@devries.nl" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Adres</Label>
              <AddressAutocomplete
                value={form.address}
                onChange={(v) => set("address", v)}
                onSelect={(fields) => {
                  setForm((f) => ({
                    ...f,
                    address: [fields.street, fields.house_number].filter(Boolean).join(" "),
                    postal_code: fields.postal_code,
                    city: fields.city,
                    lat: fields.lat,
                    lng: fields.lng,
                  }));
                }}
                placeholder="Zoek adres..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Postcode</Label>
              <Input value={form.postal_code} onChange={(e) => set("postal_code", e.target.value)} placeholder="1961 AB" />
            </div>
            <div className="space-y-1.5">
              <Label>Plaats</Label>
              <Input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Heemskerk" />
            </div>
            <div className="space-y-1.5">
              <Label>Standaard dienst</Label>
              <Select value={form.default_service_id} onValueChange={(v) => set("default_service_id", v)}>
                <SelectTrigger><SelectValue placeholder="Kies dienst" /></SelectTrigger>
                <SelectContent>
                  {services?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name} — €{s.price}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Interval (maanden)</Label>
              <Input type="number" value={form.interval_months} onChange={(e) => set("interval_months", parseInt(e.target.value) || 24)} />
            </div>
            <div className="col-span-2 flex items-center gap-3">
              <Switch checked={form.whatsapp_optin} onCheckedChange={(v) => set("whatsapp_optin", v)} />
              <Label>WhatsApp opt-in</Label>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Opmerkingen</Label>
              <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Opslaan" : "Toevoegen"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerDialog;
