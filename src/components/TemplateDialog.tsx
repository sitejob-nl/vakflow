import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateQuoteTemplate, useUpdateQuoteTemplate, type QuoteTemplateDB } from "@/hooks/useQuoteTemplates";
import { useToast } from "@/hooks/use-toast";
import type { QuoteItem, OptionalItem } from "@/hooks/useQuotes";
import QuoteTemplateBuilder, {
  type TemplateBlock,
  blocksToLegacy,
  legacyToBlocks,
} from "@/components/QuoteTemplateBuilder";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editTemplate?: QuoteTemplateDB | null;
  prefill?: { name: string; items: QuoteItem[]; optional_items: OptionalItem[] } | null;
}

const TemplateDialog = ({ open, onOpenChange, editTemplate, prefill }: Props) => {
  const createTemplate = useCreateQuoteTemplate();
  const updateTemplate = useUpdateQuoteTemplate();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [blocks, setBlocks] = useState<TemplateBlock[]>([]);

  useEffect(() => {
    if (editTemplate) {
      setName(editTemplate.name);
      if (editTemplate.blocks && Array.isArray(editTemplate.blocks) && editTemplate.blocks.length > 0) {
        setBlocks(editTemplate.blocks as TemplateBlock[]);
      } else {
        setBlocks(legacyToBlocks(editTemplate.items, editTemplate.optional_items));
      }
    } else if (prefill) {
      setName(prefill.name);
      setBlocks(legacyToBlocks(prefill.items, prefill.optional_items));
    } else {
      setName("");
      setBlocks(legacyToBlocks([], []));
    }
  }, [editTemplate, prefill, open]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Voer een naam in", variant: "destructive" });
      return;
    }

    const { items, optional_items } = blocksToLegacy(blocks);

    const payload = {
      name: name.trim(),
      items,
      optional_items,
      blocks,
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

          <QuoteTemplateBuilder blocks={blocks} onChange={setBlocks} />

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
