import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CustomerCombobox from "@/components/CustomerCombobox";
import { useCustomers } from "@/hooks/useCustomers";
import { useCreateInvoice, useUpdateInvoice } from "@/hooks/useInvoices";
import type { Invoice } from "@/hooks/useInvoices";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { useCombinedTemplates } from "@/hooks/useQuoteTemplates";
import type { QuoteItem, OptionalItem } from "@/hooks/useQuotes";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editInvoice?: Invoice | null;
}

const emptyItem = (): QuoteItem => ({ description: "", qty: 1, unit_price: 0, total: 0 });
const emptyOptional = (): OptionalItem => ({ description: "", price: 0 });

const InvoiceDialog = ({ open, onOpenChange, editInvoice }: Props) => {
  const { data: customers } = useCustomers();
  const { data: allTemplates } = useCombinedTemplates();
  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();
  const { toast } = useToast();
  const { companyId } = useAuth();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [accountingProvider, setAccountingProvider] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    (supabase.from("companies_safe" as any).select("accounting_provider").eq("id", companyId).single() as unknown as Promise<{ data: any }>).then(({ data }) => {
      setAccountingProvider(data?.accounting_provider ?? null);
    });
  }, [companyId]);

  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [items, setItems] = useState<QuoteItem[]>([emptyItem()]);
  const [optionalItems, setOptionalItems] = useState<OptionalItem[]>([]);
  const [notes, setNotes] = useState("");
  const [vatPercentage, setVatPercentage] = useState(21);
  const defaultDueDate = () => {
    const d = new Date(); d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  };
  const [dueAt, setDueAt] = useState(defaultDueDate);

  useEffect(() => {
    if (editInvoice) {
      setCustomerId(editInvoice.customer_id);
      const parsedItems = Array.isArray(editInvoice.items) && (editInvoice.items as any[]).length
        ? (editInvoice.items as unknown as QuoteItem[])
        : [emptyItem()];
      setItems(parsedItems);
      setOptionalItems(
        Array.isArray(editInvoice.optional_items) ? (editInvoice.optional_items as unknown as OptionalItem[]) : []
      );
      setNotes((editInvoice as any).notes ?? "");
      setDueAt(editInvoice.due_at ?? defaultDueDate());
    } else {
      setSelectedTemplate("");
      setCustomerId("");
      setItems([emptyItem()]);
      setOptionalItems([]);
      setNotes("");
      setDueAt(defaultDueDate());
    }
  }, [editInvoice, open]);

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

  const { subtotal, vatAmount, total } = useMemo(() => {
    const totalIncl = items.reduce((s, i) => s + i.qty * i.unit_price, 0);
    const sub = Number((totalIncl / 1.21).toFixed(2));
    const vat = Number((totalIncl - sub).toFixed(2));
    return { subtotal: sub, vatAmount: vat, total: Number(totalIncl.toFixed(2)) };
  }, [items]);

  const handleSave = async () => {
    if (!customerId) { toast({ title: "Selecteer een klant", variant: "destructive" }); return; }
    if (!items.some((i) => i.description)) { toast({ title: "Voeg minimaal één artikel toe", variant: "destructive" }); return; }

    const today = new Date().toISOString().split("T")[0];

    const payload: any = {
      customer_id: customerId,
      items: items.filter((i) => i.description).map(recalcItem),
      optional_items: optionalItems.filter((o) => o.description),
      subtotal,
      vat_percentage: 21,
      vat_amount: vatAmount,
      total,
      notes: notes || null,
      status: editInvoice?.status ?? "concept",
      issued_at: editInvoice?.issued_at ?? today,
      due_at: dueAt,
    };

    try {
      if (editInvoice) {
        await updateInvoice.mutateAsync({ id: editInvoice.id, ...payload });
        toast({ title: "Factuur bijgewerkt" });
      } else {
        const newInvoice = await createInvoice.mutateAsync(payload);

        // Auto-sync to accounting provider if connected
        if ((accountingProvider === "rompslomp" || accountingProvider === "moneybird" || accountingProvider === "eboekhouden" || accountingProvider === "wefact") && newInvoice?.id) {
          setSyncing(true);
          const funcName = accountingProvider === "rompslomp" ? "sync-rompslomp" : accountingProvider === "moneybird" ? "sync-moneybird" : accountingProvider === "wefact" ? "sync-wefact" : "sync-invoice-eboekhouden";
          const providerLabel = accountingProvider === "rompslomp" ? "Rompslomp" : accountingProvider === "moneybird" ? "Moneybird" : accountingProvider === "wefact" ? "WeFact" : "e-Boekhouden";
          try {
            const res = await supabase.functions.invoke(funcName, {
              body: { action: "create-invoice", invoice_id: newInvoice.id },
            });
            if (res.error) throw res.error;
            if (res.data?.error) throw new Error(res.data.error);
            const rNumber = res.data?.invoice_number;
            toast({ title: `✓ Factuur aangemaakt in ${providerLabel}`, description: rNumber ? `Factuurnummer: ${rNumber}` : undefined });
            queryClient.invalidateQueries({ queryKey: ["invoices"] });
          } catch (syncErr: any) {
            toast({ title: `${providerLabel} sync mislukt`, description: syncErr.message, variant: "destructive" });
          } finally {
            setSyncing(false);
          }
        } else {
          toast({ title: "Factuur aangemaakt" });
        }
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
          <DialogTitle>{editInvoice ? "Factuur bewerken" : "Nieuwe factuur"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!editInvoice && (
            <div>
              <Label>Template</Label>
              <Select value={selectedTemplate} onValueChange={(val) => {
                setSelectedTemplate(val);
                const tpl = allTemplates?.find((t) => t.id === val);
                if (tpl) {
                  setItems(tpl.items.map((i) => ({ ...i })));
                  setOptionalItems(tpl.optionalItems.map((o) => ({ ...o })));
                } else {
                  setItems([emptyItem()]);
                  setOptionalItems([]);
                }
              }}>
                <SelectTrigger><SelectValue placeholder="Blanco factuur" /></SelectTrigger>
                <SelectContent>
                  {allTemplates?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}{t.isCustom ? " ★" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Klant</Label>
            <CustomerCombobox
              customers={customers}
              value={customerId}
              onValueChange={setCustomerId}
            />
          </div>

          <div>
            <Label>Vervaldatum</Label>
            <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
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
                  <span className="text-sm font-mono w-20 text-right">€ {(item.qty * item.unit_price).toFixed(2)}</span>
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

          {/* Totals */}
          <div className="bg-muted/50 rounded-md p-3 text-sm space-y-1">
            <div className="flex justify-between"><span>Subtotaal (excl. BTW)</span><span className="font-mono">€ {subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>BTW (21%)</span><span className="font-mono">€ {vatAmount.toFixed(2)}</span></div>
            <div className="flex justify-between font-bold text-base"><span>Totaal incl. BTW</span><span className="font-mono">€ {total.toFixed(2)}</span></div>
          </div>

          {/* Notes */}
          <div>
            <Label>Notities</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optionele notities" />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
            <Button onClick={handleSave} disabled={createInvoice.isPending || updateInvoice.isPending || syncing}>
              {syncing ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Synchroniseren...</> : editInvoice ? "Opslaan" : "Aanmaken"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceDialog;
