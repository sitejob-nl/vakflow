import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      // Insert response
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

      // Update quote status
      const { error: quoteErr } = await supabase
        .from("quotes")
        .update({ status })
        .eq("id", quoteId);
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
    return <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Offertes</h1>
        <p className="text-sm text-muted-foreground">Bekijk en beoordeel uw offertes</p>
      </div>

      {!quotes?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">Geen offertes beschikbaar</p>
            <p className="text-sm">Er zijn nog geen offertes voor u beschikbaar.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {quotes.map((q) => {
            const items = (q.items ?? []) as QuoteItem[];
            const canRespond = q.status === "verzonden";
            return (
              <Card key={q.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{q.quote_number ?? "Offerte"}</CardTitle>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {q.issued_at ? format(new Date(q.issued_at), "d MMMM yyyy", { locale: nl }) : format(new Date(q.created_at), "d MMMM yyyy", { locale: nl })}
                        {q.valid_until && (
                          <span className="ml-2">· Geldig t/m {format(new Date(q.valid_until), "d MMM yyyy", { locale: nl })}</span>
                        )}
                      </p>
                    </div>
                    <Badge variant="secondary" className={statusColors[q.status] ?? ""}>
                      {statusLabels[q.status] ?? q.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Items table */}
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">Omschrijving</th>
                          <th className="text-right px-3 py-2 font-medium w-20">Aantal</th>
                          <th className="text-right px-3 py-2 font-medium w-24">Prijs</th>
                          <th className="text-right px-3 py-2 font-medium w-24">Totaal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, idx) => (
                          <tr key={idx} className="border-t border-border/50">
                            <td className="px-3 py-2">{item.description}</td>
                            <td className="text-right px-3 py-2">{item.quantity}</td>
                            <td className="text-right px-3 py-2">€{(item.unit_price ?? 0).toFixed(2)}</td>
                            <td className="text-right px-3 py-2">€{(item.total ?? 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals */}
                  <div className="flex justify-end">
                    <div className="w-48 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Subtotaal</span>
                        <span>€{(q.subtotal ?? 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">BTW ({q.vat_percentage}%)</span>
                        <span>€{(q.vat_amount ?? 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-base border-t border-border pt-1">
                        <span>Totaal</span>
                        <span>€{(q.total ?? 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {q.notes && (
                    <div className="bg-muted/30 rounded-lg p-3 text-sm text-muted-foreground">
                      {q.notes}
                    </div>
                  )}

                  {/* Action buttons */}
                  {canRespond && (
                    <div className="flex gap-3 pt-2">
                      <Button onClick={() => handleRespond(q, "goedgekeurd")} className="flex-1 bg-accent hover:bg-accent-hover text-accent-foreground">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Goedkeuren
                      </Button>
                      <Button variant="outline" onClick={() => handleRespond(q, "afgewezen")} className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/5">
                        <XCircle className="h-4 w-4 mr-2" />
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {respondStatus === "goedgekeurd" ? "Offerte goedkeuren" : "Offerte afwijzen"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedQuote && (
              <div className="bg-muted/30 rounded-lg p-3 text-sm">
                <p className="font-medium">{selectedQuote.quote_number}</p>
                <p className="text-muted-foreground">Totaal: €{(selectedQuote.total ?? 0).toFixed(2)}</p>
              </div>
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
