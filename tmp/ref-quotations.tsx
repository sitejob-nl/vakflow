import { useState } from "react";
import { Loader2, FileText, Download, Calendar, Euro, CheckCircle, Clock, XCircle, Receipt, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRompslompQuotationsByContact, useRompslompQuotations, useDownloadQuotationPdf, useRompslompSettings, useConvertQuotationToInvoice, RompslompQuotation } from "@/hooks/useRompslomp";
import { format, addDays } from "date-fns";
import { nl } from "date-fns/locale";
import { toast } from "sonner";

interface RompslompQuotationsProps {
  companyId?: number | null;
  contactId?: number | null;
  customerName?: string;
}

const statusConfig: Record<string, { label: string; icon: React.ReactNode; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  concept: { label: "Concept", icon: <Clock className="w-3 h-3" />, variant: "secondary" },
  published: { label: "Verzonden", icon: <FileText className="w-3 h-3" />, variant: "outline" },
  approved: { label: "Goedgekeurd", icon: <CheckCircle className="w-3 h-3" />, variant: "default" },
  stopped: { label: "Gestopt", icon: <XCircle className="w-3 h-3" />, variant: "destructive" },
  invoiced: { label: "Gefactureerd", icon: <Receipt className="w-3 h-3" />, variant: "default" },
};

export function RompslompQuotations({ companyId: propCompanyId, contactId, customerName }: RompslompQuotationsProps) {
  const { data: settings } = useRompslompSettings();
  const companyId = propCompanyId ?? settings?.company_id ?? null;
  
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<RompslompQuotation | null>(null);
  const [dueDate, setDueDate] = useState(() => format(addDays(new Date(), 30), 'yyyy-MM-dd'));
  
  // Use all quotations if no contactId, otherwise filter by contact
  const { data: allQuotations = [], isLoading: allLoading } = useRompslompQuotations(
    contactId ? null : companyId, 
    {}
  );
  const { data: contactQuotations = [], isLoading: contactLoading } = useRompslompQuotationsByContact(
    contactId ? companyId : null, 
    contactId
  );
  
  const quotations = contactId ? contactQuotations : allQuotations;
  const isLoading = contactId ? contactLoading : allLoading;
  
  const downloadPdf = useDownloadQuotationPdf();
  const convertToInvoice = useConvertQuotationToInvoice();

  const handleDownload = async (quotation: RompslompQuotation) => {
    if (!companyId) return;
    try {
      await downloadPdf.mutateAsync({
        companyId,
        quotationId: quotation.id,
        quotationNumber: quotation.invoice_number,
      });
      toast.success("Offerte gedownload");
    } catch (error) {
      toast.error("Kon offerte niet downloaden");
    }
  };

  const handleConvertClick = (quotation: RompslompQuotation) => {
    setSelectedQuotation(quotation);
    setDueDate(format(addDays(new Date(), 30), 'yyyy-MM-dd'));
    setConvertDialogOpen(true);
  };

  const handleConvertConfirm = async () => {
    if (!companyId || !selectedQuotation) return;
    
    try {
      await convertToInvoice.mutateAsync({
        companyId,
        quotation: selectedQuotation,
        dueDate,
      });
      toast.success("Factuur aangemaakt op basis van offerte");
      setConvertDialogOpen(false);
      setSelectedQuotation(null);
    } catch (error) {
      toast.error("Kon offerte niet omzetten naar factuur");
    }
  };

  const calculateTotal = (quotation: RompslompQuotation) => {
    return quotation.invoice_lines.reduce((sum, line) => {
      return sum + parseFloat(line.price_with_vat || "0");
    }, 0);
  };

  if (!companyId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Offertes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Koppel eerst Rompslomp om offertes te bekijken.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Offertes
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Offertes {customerName && <span className="text-muted-foreground font-normal">voor {customerName}</span>}
            {!contactId && <span className="text-muted-foreground font-normal text-sm">({quotations.length})</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {quotations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {contactId ? "Geen offertes gevonden voor deze klant." : "Geen offertes gevonden."}
            </p>
          ) : (
            <div className="space-y-3">
              {quotations.map((quotation) => {
                const status = statusConfig[quotation.status] || statusConfig.concept;
                const total = calculateTotal(quotation);
                const canConvert = quotation.status === 'approved' || quotation.status === 'published' || quotation.status === 'concept';
                
                return (
                  <div
                    key={quotation.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">
                          {quotation.invoice_number || `Offerte #${quotation.id}`}
                        </span>
                        <Badge variant={status.variant} className="flex items-center gap-1">
                          {status.icon}
                          {status.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(quotation.date), "d MMM yyyy", { locale: nl })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Euro className="w-3 h-3" />
                          €{total.toFixed(2)}
                        </span>
                        <span>{quotation.invoice_lines.length} regel(s)</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {canConvert && quotation.status !== 'invoiced' && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleConvertClick(quotation)}
                          className="hidden sm:flex"
                        >
                          <ArrowRight className="w-4 h-4 mr-1" />
                          Naar Factuur
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(quotation)}
                        disabled={downloadPdf.isPending}
                      >
                        {downloadPdf.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Download className="w-4 h-4 mr-1" />
                            PDF
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Convert to Invoice Dialog */}
      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Offerte omzetten naar factuur</DialogTitle>
            <DialogDescription>
              {selectedQuotation && (
                <>Maak een factuur aan op basis van {selectedQuotation.invoice_number || `offerte #${selectedQuotation.id}`}.</>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {selectedQuotation && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Aantal regels</span>
                  <span>{selectedQuotation.invoice_lines.length}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Totaalbedrag</span>
                  <span>€{calculateTotal(selectedQuotation).toFixed(2)}</span>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="dueDate">Vervaldatum factuur</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertDialogOpen(false)}>
              Annuleren
            </Button>
            <Button 
              onClick={handleConvertConfirm}
              disabled={convertToInvoice.isPending}
            >
              {convertToInvoice.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Receipt className="w-4 h-4 mr-2" />
              )}
              Factuur Aanmaken
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
