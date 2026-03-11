import { useState } from "react";
import { Loader2, FileText, Download, Calendar, CheckCircle, Clock, XCircle, Receipt, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRompslompQuotations, useDownloadQuotationPdf, useRompslompSettings, useConvertQuotationToInvoice } from "@/hooks/useRompslomp";
import type { RompslompQuotation } from "@/hooks/useRompslomp";
import { format, addDays } from "date-fns";
import { nl } from "date-fns/locale";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; icon: React.ReactNode; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  concept: { label: "Concept", icon: <Clock className="w-3 h-3" />, variant: "secondary" },
  published: { label: "Verzonden", icon: <FileText className="w-3 h-3" />, variant: "outline" },
  approved: { label: "Goedgekeurd", icon: <CheckCircle className="w-3 h-3" />, variant: "default" },
  stopped: { label: "Gestopt", icon: <XCircle className="w-3 h-3" />, variant: "destructive" },
  invoiced: { label: "Gefactureerd", icon: <Receipt className="w-3 h-3" />, variant: "default" },
};

export function RompslompQuotations() {
  const { data: settings } = useRompslompSettings();
  const hasSettings = !!settings?.company_id;

  const [convertOpen, setConvertOpen] = useState(false);
  const [selected, setSelected] = useState<RompslompQuotation | null>(null);
  const [dueDate, setDueDate] = useState(() => format(addDays(new Date(), 30), "yyyy-MM-dd"));

  const { data: quotations = [], isLoading } = useRompslompQuotations(hasSettings);
  const downloadPdf = useDownloadQuotationPdf();
  const convertToInvoice = useConvertQuotationToInvoice();

  const handleDownload = async (q: RompslompQuotation) => {
    try {
      await downloadPdf.mutateAsync({ quotationId: q.id, quotationNumber: q.invoice_number });
      toast.success("Offerte gedownload");
    } catch {
      toast.error("Download mislukt");
    }
  };

  const handleConvertClick = (q: RompslompQuotation) => {
    setSelected(q);
    setDueDate(format(addDays(new Date(), 30), "yyyy-MM-dd"));
    setConvertOpen(true);
  };

  const handleConvertConfirm = async () => {
    if (!selected) return;
    try {
      await convertToInvoice.mutateAsync({ quotation: selected, dueDate });
      toast.success("Factuur aangemaakt");
      setConvertOpen(false);
    } catch {
      toast.error("Conversie mislukt");
    }
  };

  const calcTotal = (q: RompslompQuotation) => q.invoice_lines.reduce((s, l) => s + parseFloat(l.price_with_vat || "0"), 0);

  if (!hasSettings) return null;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <h3 className="text-[14px] font-bold text-foreground">Offertes ({quotations.length})</h3>

        {quotations.length === 0 ? (
          <p className="text-center py-8 text-[13px] text-muted-foreground">Geen offertes gevonden</p>
        ) : (
          <div className="space-y-2">
            {quotations.map((q) => {
              const status = statusConfig[q.status] || statusConfig.concept;
              const total = calcTotal(q);
              const canConvert = ["approved", "published", "concept"].includes(q.status) && q.status !== "invoiced";

              return (
                <div key={q.id} className="flex items-center justify-between p-3 border border-border rounded-lg bg-card hover:bg-muted/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[13px] font-medium text-foreground">{q.invoice_number || `Offerte #${q.id}`}</span>
                      <Badge variant={status.variant} className="flex items-center gap-1 text-[10px]">
                        {status.icon} {status.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(new Date(q.date), "d MMM yyyy", { locale: nl })}</span>
                      <span>€{total.toFixed(2)}</span>
                      <span>{q.invoice_lines.length} regel(s)</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {canConvert && (
                      <Button variant="default" size="sm" onClick={() => handleConvertClick(q)} className="hidden sm:flex text-[11px] h-7">
                        <ArrowRight className="w-3 h-3 mr-1" /> Factuur
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => handleDownload(q)} disabled={downloadPdf.isPending} className="text-[11px] h-7">
                      {downloadPdf.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Download className="w-3 h-3 mr-1" /> PDF</>}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Offerte → Factuur</DialogTitle>
            <DialogDescription>
              {selected && <>Maak factuur aan op basis van {selected.invoice_number || `offerte #${selected.id}`}.</>}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            {selected && (
              <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-[13px]">
                <div className="flex justify-between"><span>Regels</span><span>{selected.invoice_lines.length}</span></div>
                <div className="flex justify-between font-medium"><span>Totaal</span><span>€{calcTotal(selected).toFixed(2)}</span></div>
              </div>
            )}
            <div>
              <label className="block text-[12px] font-bold text-secondary-foreground mb-1">Vervaldatum</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-sm text-[13px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertOpen(false)}>Annuleren</Button>
            <Button onClick={handleConvertConfirm} disabled={convertToInvoice.isPending}>
              {convertToInvoice.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Receipt className="w-4 h-4 mr-1" />}
              Factuur Aanmaken
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
