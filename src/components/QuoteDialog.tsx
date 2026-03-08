import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCustomers } from "@/hooks/useCustomers";
import { useCreateQuote, useUpdateQuote, useConvertQuoteToContract, useConvertQuoteToWorkOrder, useConvertQuoteToInvoice, useConvertQuoteToProject, type Quote, type QuoteItem, type OptionalItem } from "@/hooks/useQuotes";
import { useAssets } from "@/hooks/useAssets";
import { useIndustryConfig } from "@/hooks/useIndustryConfig";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Loader2, ArrowRightLeft, FileText, Receipt, CalendarPlus, FolderKanban } from "lucide-react";
import { useCombinedTemplates } from "@/hooks/useQuoteTemplates";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editQuote?: Quote | null;
  onScheduleAppointment?: (quote: Quote) => void;
}

const emptyItem = (): QuoteItem => ({ description: "", qty: 1, unit_price: 0, total: 0 });
const emptyOptional = (): OptionalItem => ({ description: "", price: 0 });

const QuoteDialog = ({ open, onOpenChange, editQuote, onScheduleAppointment }: Props) => {
  const { data: customers } = useCustomers();
  const { data: assets } = useAssets();
  const { data: allTemplates } = useCombinedTemplates();
  const { industry } = useIndustryConfig();
  const isCleaning = industry === "cleaning";
  const createQuote = useCreateQuote();
  const updateQuote = useUpdateQuote();
  const convertToContract = useConvertQuoteToContract();
  const convertToWorkOrder = useConvertQuoteToWorkOrder();
  const convertToInvoice = useConvertQuoteToInvoice();
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
  const [assetId, setAssetId] = useState("");
  useEffect(() => {
    if (editQuote) {
      setCustomerId(editQuote.customer_id);
      setItems(editQuote.items.length ? editQuote.items : [emptyItem()]);
      setOptionalItems(editQuote.optional_items);
      setNotes(editQuote.notes ?? "");
      setAssetId((editQuote as any).asset_id ?? "");
    } else {
      setSelectedTemplate("");
      setCustomerId("");
      setItems([emptyItem()]);
      setOptionalItems([]);
      setNotes("");
      setAssetId("");
    }
  }, [editQuote, open]);

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

    const payload: any = {
      customer_id: customerId,
      items: items.filter((i) => i.description).map(recalcItem),
      optional_items: optionalItems.filter((o) => o.description),
      subtotal,
      vat_percentage: 21,
      vat_amount: vatAmount,
      total,
      notes: notes || null,
      asset_id: assetId || null,
      status: editQuote?.status ?? "concept",
      issued_at: editQuote?.issued_at ?? null,
      valid_until: editQuote?.valid_until ?? null,
    };

    try {
      if (editQuote) {
        await updateQuote.mutateAsync({ id: editQuote.id, ...payload });
        toast({ title: "Offerte bijgewerkt" });
      } else {
        const newQuote = await createQuote.mutateAsync(payload);

        // Auto-sync to accounting provider if connected
        if ((accountingProvider === "rompslomp" || accountingProvider === "moneybird" || accountingProvider === "eboekhouden" || accountingProvider === "wefact") && newQuote?.id) {
          setSyncing(true);
          const funcName = accountingProvider === "rompslomp" ? "sync-rompslomp" : accountingProvider === "moneybird" ? "sync-moneybird" : accountingProvider === "wefact" ? "sync-wefact" : "sync-invoice-eboekhouden";
          const providerLabel = accountingProvider === "rompslomp" ? "Rompslomp" : accountingProvider === "moneybird" ? "Moneybird" : accountingProvider === "wefact" ? "WeFact" : "e-Boekhouden";
          try {
            const res = await supabase.functions.invoke(funcName, {
              body: { action: "create-quote", quote_id: newQuote.id },
            });
            if (res.error) throw res.error;
            if (res.data?.error) throw new Error(res.data.error);
            const qNumber = res.data?.quote_number;
            toast({ title: `✓ Offerte aangemaakt in ${providerLabel}`, description: qNumber ? `Offertenummer: ${qNumber}` : undefined });
            queryClient.invalidateQueries({ queryKey: ["quotes"] });
          } catch (syncErr: any) {
            toast({ title: `${providerLabel} sync mislukt`, description: syncErr.message, variant: "destructive" });
          } finally {
            setSyncing(false);
          }
        } else {
          toast({ title: "Offerte aangemaakt" });
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
          <DialogTitle>{editQuote ? "Offerte bewerken" : "Nieuwe offerte"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!editQuote && (
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
                <SelectTrigger><SelectValue placeholder="Blanco offerte" /></SelectTrigger>
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
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger><SelectValue placeholder="Selecteer klant" /></SelectTrigger>
              <SelectContent>
                {customers?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Asset link (cleaning) */}
          {isCleaning && (
            <div>
              <Label>Object (optioneel)</Label>
              <Select value={assetId} onValueChange={(v) => setAssetId(v === "_none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Geen object" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Geen object</SelectItem>
                  {(assets ?? []).filter((a) => !customerId || a.customer_id === customerId).map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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

          <div className="flex justify-between gap-2">
            <div>
              {editQuote && editQuote.status === "geaccepteerd" && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        await convertToContract.mutateAsync(editQuote);
                        toast({ title: "Contract aangemaakt vanuit offerte" });
                        onOpenChange(false);
                      } catch (err: any) {
                        toast({ title: "Fout", description: err.message, variant: "destructive" });
                      }
                    }}
                    disabled={convertToContract.isPending}
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />
                    Contract
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        const wo = await convertToWorkOrder.mutateAsync(editQuote);
                        toast({ title: `Werkbon ${(wo as any).work_order_number ?? ""} aangemaakt` });
                        onOpenChange(false);
                      } catch (err: any) {
                        toast({ title: "Fout", description: err.message, variant: "destructive" });
                      }
                    }}
                    disabled={convertToWorkOrder.isPending}
                  >
                    <FileText className="h-3.5 w-3.5 mr-1" />
                    Werkbon
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        const inv = await convertToInvoice.mutateAsync(editQuote);
                        toast({ title: `Factuur ${(inv as any).invoice_number ?? ""} aangemaakt als concept` });
                        onOpenChange(false);
                      } catch (err: any) {
                        toast({ title: "Fout", description: err.message, variant: "destructive" });
                      }
                    }}
                    disabled={convertToInvoice.isPending}
                  >
                    <Receipt className="h-3.5 w-3.5 mr-1" />
                    Factuur
                  </Button>
                  {onScheduleAppointment && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onScheduleAppointment(editQuote);
                        onOpenChange(false);
                      }}
                    >
                      <CalendarPlus className="h-3.5 w-3.5 mr-1" />
                      Afspraak
                    </Button>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
              <Button onClick={handleSave} disabled={createQuote.isPending || updateQuote.isPending || syncing}>
                {syncing ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Synchroniseren...</> : editQuote ? "Opslaan" : "Aanmaken"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QuoteDialog;
