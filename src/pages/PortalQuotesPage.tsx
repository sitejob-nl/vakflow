import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, CheckCircle, XCircle, Calendar } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import SignatureCanvas from "@/components/SignatureCanvas";

const statusColors: Record<string, string> = {
  concept: "bg-muted text-muted-foreground",
  verzonden: "bg-primary/10 text-primary",
  goedgekeurd: "bg-accent/10 text-accent",
  afgewezen: "bg-destructive/10 text-destructive",
};

const statusLabels: Record<string, string> = {
  concept: "Concept",
  verzonden: "Verzonden",
  goedgekeurd: "Goedgekeurd",
  afgewezen: "Afgewezen",
};

type QuoteItem = { description: string; quantity: number; unit_price: number; total: number };

const PortalQuotesPage = () => {
  const { customerId, companyId } = usePortalAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [selectedQuote, setSelectedQuote] = useState<any | null>(null);
  const [respondOpen, setRespondOpen] = useState(false);
  const [respondStatus, setRespondStatus] = useState<"goedgekeurd" | "afgewezen">("goedgekeurd");
  const [signatureData, setSignatureData] = useState("");
  const [notes, setNotes] = useState("");

  const { data: quotes, isLoading } = useQuery({
    queryKey: ["portal-quotes", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*")
        .eq("customer_id", customerId!)
        .in("status", ["verzonden", "goedgekeurd", "afgewezen"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const respond = useMutation({
    mutationFn: async ({ quoteId, status, signature, responseNotes }: { quoteId: string; status: string; signature: string; responseNotes: string }) => {
      const { error: respErr } = await supabase.from("quote_responses").insert({
        quote_id: quoteId,
        company_id: companyId!,
        customer_id: customerId!,
        status,
        signature_data: signature || null,
        notes: responseNotes || null,
        responded_by: (await supabase.auth.getUser()).data.user?.id,
      });
      if (respErr) throw respErr;
      const { error: quoteErr } = await supabase.from("quotes").update({ status }).eq("id", quoteId);
      if (quoteErr) throw quoteErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal-quotes"] });
      toast({ title: respondStatus === "goedgekeurd" ? "Offerte goedgekeurd" : "Offerte afgewezen" });
      setRespondOpen(false);
      setSelectedQuote(null);
      setSignatureData("");
      setNotes("");
    },
    onError: (e: any) => toast({ title: "Fout", description: e.message, variant: "destructive" }),
  });

  const handleRespond = (quote: any, status: "goedgekeurd" | "afgewezen") => {
    setSelectedQuote(quote);
    setRespondStatus(status);
    setRespondOpen(true);
  };

  const handleSubmitResponse = () => {
    if (!selectedQuote) return;
    if (respondStatus === "goedgekeurd" && !signatureData) {
      toast({ title: "Handtekening vereist", description: "Teken uw handtekening om de offerte goed te keuren.", variant: "destructive" });
      return;
    }
    respond.mutate({
      quoteId: selectedQuote.id,
      status: respondStatus,
      signature: signatureData,
      responseNotes: notes,
    });
  };

  if (isLoading) {
    return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Offertes</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">Bekijk en beoordeel uw offertes</p>
      </div>

      {!quotes?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-base font-medium">Geen offertes beschikbaar</p>
            <p className="text-sm">Er zijn nog geen offertes voor u beschikbaar.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {quotes.map((q) => {
            const canRespond = q.status === "verzonden";
            return (
              <Card key={q.id} className="overflow-hidden">
                <CardContent className="p-3.5 sm:p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{q.quote_number ?? "Offerte"}</span>
                        <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${statusColors[q.status] ?? ""}`}>
                          {statusLabels[q.status] ?? q.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Calendar className="h-3 w-3 shrink-0" />
                        {q.issued_at ? format(new Date(q.issued_at), "d MMM yyyy", { locale: nl }) : format(new Date(q.created_at), "d MMM yyyy", { locale: nl })}
                        {q.valid_until && (
                          <span className="hidden sm:inline ml-1">· Geldig t/m {format(new Date(q.valid_until), "d MMM yyyy", { locale: nl })}</span>
                        )}
                      </p>
                    </div>
                    <span className="font-bold text-sm whitespace-nowrap">€{(q.total ?? 0).toFixed(2)}</span>
                  </div>

                  {canRespond && (
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handleRespond(q, "goedgekeurd"); }}
                        className="flex-1 h-8 text-xs bg-accent hover:bg-accent-hover text-accent-foreground"
                      >
                        <CheckCircle className="h-3.5 w-3.5 mr-1" />
                        Goedkeuren
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => { e.stopPropagation(); handleRespond(q, "afgewezen"); }}
                        className="flex-1 h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/5"
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        Afwijzen
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Response dialog */}
      <Dialog open={respondOpen} onOpenChange={setRespondOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>
              {respondStatus === "goedgekeurd" ? "Offerte goedkeuren" : "Offerte afwijzen"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedQuote && (
              <>
                <div className="bg-muted/30 rounded-lg p-3 text-sm">
                  <p className="font-medium">{selectedQuote.quote_number}</p>
                  <p className="text-muted-foreground">Totaal: €{(selectedQuote.total ?? 0).toFixed(2)}</p>
                </div>

                {/* Items */}
                <div className="space-y-2">
                  {((selectedQuote.items ?? []) as QuoteItem[]).map((item, idx) => (
                    <div key={idx} className="bg-muted/20 rounded-lg p-2.5">
                      <p className="text-sm font-medium">{item.description}</p>
                      <div className="flex items-center justify-between mt-0.5 text-xs text-muted-foreground">
                        <span>{item.quantity}x · €{(item.unit_price ?? 0).toFixed(2)}</span>
                        <span className="font-semibold text-foreground">€{(item.total ?? 0).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {respondStatus === "goedgekeurd" && (
              <div className="space-y-2">
                <Label>Handtekening *</Label>
                <SignatureCanvas onSave={setSignatureData} />
              </div>
            )}

            <div className="space-y-2">
              <Label>Opmerkingen (optioneel)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={respondStatus === "goedgekeurd" ? "Eventuele opmerkingen..." : "Reden van afwijzing..."}
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setRespondOpen(false)} className="flex-1">
                Annuleren
              </Button>
              <Button
                onClick={handleSubmitResponse}
                disabled={respond.isPending}
                className={`flex-1 ${respondStatus === "goedgekeurd" ? "bg-accent hover:bg-accent-hover text-accent-foreground" : "bg-destructive hover:bg-destructive/90 text-destructive-foreground"}`}
              >
                {respond.isPending ? "Verwerken..." : respondStatus === "goedgekeurd" ? "Goedkeuren" : "Afwijzen"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PortalQuotesPage;
