import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateAddress, useUpdateAddress, type Address } from "@/hooks/useAddresses";
import { useToast } from "@/hooks/use-toast";
import AddressAutocomplete from "@/components/AddressAutocomplete";

interface AddressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  address?: Address | null;
}

const AddressDialog = ({ open, onOpenChange, customerId, address }: AddressDialogProps) => {
  const { toast } = useToast();
  const createAddress = useCreateAddress();
  const updateAddress = useUpdateAddress();
  const isEdit = !!address;

  const [form, setForm] = useState({
    street: "",
    house_number: "",
    apartment: "",
    postal_code: "",
    city: "",
    notes: "",
    lat: null as number | null,
    lng: null as number | null,
  });

  useEffect(() => {
    if (address) {
      setForm({
        street: address.street ?? "",
        house_number: address.house_number ?? "",
        apartment: address.apartment ?? "",
        postal_code: address.postal_code ?? "",
        city: address.city ?? "",
        notes: address.notes ?? "",
        lat: (address as any).lat ?? null,
        lng: (address as any).lng ?? null,
      });
    } else {
      setForm({ street: "", house_number: "", apartment: "", postal_code: "", city: "", notes: "", lat: null, lng: null });
    }
  }, [address, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEdit) {
        await updateAddress.mutateAsync({ id: address.id, customer_id: customerId, ...form });
        toast({ title: "Adres bijgewerkt" });
      } else {
        await createAddress.mutateAsync({ customer_id: customerId, ...form });
        toast({ title: "Adres toegevoegd" });
      }
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  const [addressSearch, setAddressSearch] = useState("");

  // Sync search field with street + house_number
  useEffect(() => {
    setAddressSearch([form.street, form.house_number].filter(Boolean).join(" "));
  }, [form.street, form.house_number]);

  const fields: { key: keyof typeof form; label: string; placeholder: string; half?: boolean }[] = [
    { key: "apartment", label: "Toevoeging / Apt", placeholder: "4B", half: true },
    { key: "postal_code", label: "Postcode", placeholder: "1961 XX", half: true },
    { key: "city", label: "Plaats", placeholder: "Heemskerk", half: true },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Adres bewerken" : "Nieuw adres toevoegen"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-[12px] font-bold text-t3 mb-1 block">Adres</Label>
              <AddressAutocomplete
                value={addressSearch}
                onChange={setAddressSearch}
                onSelect={(fields) => {
                  setForm((prev) => ({
                    ...prev,
                    street: fields.street,
                    house_number: fields.house_number,
                    postal_code: fields.postal_code,
                    city: fields.city,
                    lat: fields.lat,
                    lng: fields.lng,
                  }));
                }}
                placeholder="Zoek adres..."
              />
            </div>
            {fields.map((f) => (
              <div key={f.key} className={f.half ? "" : "col-span-2"}>
                <Label className="text-[12px] font-bold text-t3 mb-1 block">{f.label}</Label>
                <Input
                  value={form[f.key] as string}
                  onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                />
              </div>
            ))}
            <div className="col-span-2">
              <Label className="text-[12px] font-bold text-t3 mb-1 block">Notities</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Bijv. sleutel bij buren, parkeren achterom..."
                rows={2}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => onOpenChange(false)} className="px-4 py-2 bg-card border border-border rounded-sm text-[13px] font-bold text-secondary-foreground hover:bg-bg-hover transition-colors">
              Annuleren
            </button>
            <button type="submit" disabled={createAddress.isPending || updateAddress.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-sm text-[13px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50">
              {isEdit ? "Opslaan" : "Toevoegen"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddressDialog;
