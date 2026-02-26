import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { useCreateQuoteTemplate, useUpdateQuoteTemplate, type QuoteTemplateDB } from "@/hooks/useQuoteTemplates";
import { useToast } from "@/hooks/use-toast";
import type { QuoteItem, OptionalItem } from "@/hooks/useQuotes";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editTemplate?: QuoteTemplateDB | null;
  prefill?: { name: string; items: QuoteItem[]; optional_items: OptionalItem[] } | null;
}

const emptyItem = (): QuoteItem => ({ description: "", qty: 1, unit_price: 0, total: 0 });
const emptyOptional = (): OptionalItem => ({ description: "", price: 0 });

const TemplateDialog = ({ open, onOpenChange, editTemplate, prefill }: Props) => {
  const createTemplate = useCreateQuoteTemplate();
  const updateTemplate = useUpdateQuoteTemplate();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [items, setItems] = useState<QuoteItem[]>([emptyItem()]);
  const [optionalItems, setOptionalItems] = useState<OptionalItem[]>([]);

  useEffect(() => {
    if (editTemplate) {
      setName(editTemplate.name);
      setItems(editTemplate.items.length ? editTemplate.items.map((i) => ({ ...i })) : [emptyItem()]);
      setOptionalItems(editTemplate.optional_items.map((o) => ({ ...o })));
    } else if (prefill) {
      setName(prefill.name);
      setItems(prefill.items.length ? prefill.items.map((i) => ({ ...i })) : [emptyItem()]);
      setOptionalItems(prefill.optional_items.map((o) => ({ ...o })));
    } else {
      setName("");
      setItems([emptyItem()]);
      setOptionalItems([]);
    }
  }, [editTemplate, prefill, open]);

  const recalcItem = (item: QuoteItem): QuoteItem => ({
    ...item,
    total: Number((item.qty * item.unit_price).toFixed(2)),
  });

  const updateItem = (idx: number, field: keyof QuoteItem, value: string) => {
    setItems((prev) => {
      const copy = [...prev];
      if (field === "description") copy[idx] = { ...copy[idx], description: value };
      else if (field === "qty") copy[idx] = recalcItem({ ...copy[idx], qty: Number(value) || 0 });
      else if (field === "unit_price") copy[idx] = recalcItem({ ...copy[idx], unit_price: Number(value) || 0 });
      return copy;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Voer een naam in", variant: "destructive" });
      return;
    }

    const payload = {
      name: name.trim(),
      items: items.filter((i) => i.description).map(recalcItem),
      optional_items: optionalItems.filter((o) => o.description),
    };

    try {
      if (editTemplate) {
        await updateTemplate.mutateAsync({ id: editTemplate.id, ...payload });
        toast({ title: "Sjabloon bijgewerkt" });
      } else {
        await createTemplate.mutateAsync(payload);
        toast({ title: "Sjabloon aangemaakt" });
      }
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editTemplate ? "Sjabloon bewerken" : "Nieuw sjabloon"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Naam</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bijv. Itho Euro Custom" />
          </div>

          {/* Line items */}
          <div>
            <Label className="mb-2 block">Artikelen</Label>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-end">
                  <Input placeholder="Omschrijving" value={item.description} onChange={(e) => updateItem(idx, "description", e.target.value)} className="flex-1" />
                  <Input type="number" placeholder="Aantal" value={item.qty || ""} onChange={(e) => updateItem(idx, "qty", e.target.value)} className="w-20" />
                  <Input type="number" placeholder="Prijs incl." value={item.unit_price || ""} onChange={(e) => updateItem(idx, "unit_price", e.target.value)} className="w-24" />
                  {items.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => setItems((p) => [...p, emptyItem()])}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Artikel toevoegen
            </Button>
          </div>

          {/* Optional items */}
          <div>
            <Label className="mb-2 block">Optionele items</Label>
            <div className="space-y-2">
              {optionalItems.map((opt, idx) => (
                <div key={idx} className="flex gap-2 items-end">
                  <Input placeholder="Omschrijving" value={opt.description} onChange={(e) => setOptionalItems((p) => p.map((o, i) => i === idx ? { ...o, description: e.target.value } : o))} className="flex-1" />
                  <Input type="number" placeholder="Prijs incl." value={opt.price || ""} onChange={(e) => setOptionalItems((p) => p.map((o, i) => i === idx ? { ...o, price: Number(e.target.value) || 0 } : o))} className="w-24" />
                  <Button variant="ghost" size="icon" onClick={() => setOptionalItems((p) => p.filter((_, i) => i !== idx))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => setOptionalItems((p) => [...p, emptyOptional()])}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Optioneel item
            </Button>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
            <Button onClick={handleSave} disabled={createTemplate.isPending || updateTemplate.isPending}>
              {editTemplate ? "Opslaan" : "Aanmaken"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TemplateDialog;
