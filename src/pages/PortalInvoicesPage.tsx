import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Receipt, Calendar } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type InvoiceItem = { description: string; quantity: number; unit_price: number; total: number };

const statusColors: Record<string, string> = {
  concept: "bg-muted text-muted-foreground",
  verzonden: "bg-primary/10 text-primary",
  betaald: "bg-accent/10 text-accent",
  verlopen: "bg-destructive/10 text-destructive",
};

const statusLabels: Record<string, string> = {
  concept: "Concept",
  verzonden: "Openstaand",
  betaald: "Betaald",
  verlopen: "Verlopen",
};

const PortalInvoicesPage = () => {
  const { customerId } = usePortalAuth();
  const [selected, setSelected] = useState<any | null>(null);

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["portal-invoices", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("customer_id", customerId!)
        .in("status", ["verzonden", "betaald", "verlopen"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Facturen</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">Bekijk uw facturen en betalingsstatus</p>
      </div>

      {!invoices?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Receipt className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-base font-medium">Geen facturen beschikbaar</p>
            <p className="text-sm">Er zijn nog geen facturen voor u beschikbaar.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {invoices.map((inv) => (
            <Card
              key={inv.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelected(inv)}
            >
              <CardContent className="p-3.5 sm:p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{inv.invoice_number ?? "Factuur"}</span>
                      <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${statusColors[inv.status] ?? ""}`}>
                        {statusLabels[inv.status] ?? inv.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Calendar className="h-3 w-3 shrink-0" />
                      {inv.issued_at
                        ? format(new Date(inv.issued_at), "d MMM yyyy", { locale: nl })
                        : format(new Date(inv.created_at), "d MMM yyyy", { locale: nl })}
                      {inv.due_at && (
                        <span className="hidden sm:inline ml-1">· Vervalt {format(new Date(inv.due_at), "d MMM yyyy", { locale: nl })}</span>
                      )}
                    </p>
                  </div>
                  <span className="font-bold text-sm whitespace-nowrap">€{(inv.total ?? 0).toFixed(2)}</span>
                </div>
                {inv.paid_at && (
                  <p className="text-[11px] text-accent mt-1.5">
                    Betaald op {format(new Date(inv.paid_at), "d MMM yyyy", { locale: nl })}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto p-4 sm:p-6">
          {selected && (() => {
            const items = (selected.items ?? []) as InvoiceItem[];
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 flex-wrap">
                    {selected.invoice_number ?? "Factuur"}
                    <Badge variant="secondary" className={statusColors[selected.status] ?? ""}>
                      {statusLabels[selected.status] ?? selected.status}
                    </Badge>
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 mt-2">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {selected.issued_at
                      ? format(new Date(selected.issued_at), "d MMMM yyyy", { locale: nl })
                      : format(new Date(selected.created_at), "d MMMM yyyy", { locale: nl })}
                    {selected.due_at && (
                      <span className="ml-2">· Vervalt {format(new Date(selected.due_at), "d MMM yyyy", { locale: nl })}</span>
                    )}
                  </p>

                  {/* Items - mobile-friendly stacked layout */}
                  <div className="space-y-2">
                    {items.map((item, idx) => (
                      <div key={idx} className="bg-muted/30 rounded-lg p-3">
                        <p className="text-sm font-medium">{item.description}</p>
                        <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                          <span>{item.quantity}x · €{(item.unit_price ?? 0).toFixed(2)}</span>
                          <span className="font-semibold text-foreground">€{(item.total ?? 0).toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div className="border-t border-border pt-3 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotaal</span>
                      <span>€{(selected.subtotal ?? 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">BTW ({selected.vat_percentage}%)</span>
                      <span>€{(selected.vat_amount ?? 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-base pt-1 border-t border-border">
                      <span>Totaal</span>
                      <span>€{(selected.total ?? 0).toFixed(2)}</span>
                    </div>
                  </div>

                  {selected.paid_at && (
                    <div className="bg-accent/5 rounded-lg p-3 text-sm text-accent">
                      Betaald op {format(new Date(selected.paid_at), "d MMMM yyyy", { locale: nl })}
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PortalInvoicesPage;
