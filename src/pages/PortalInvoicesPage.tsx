import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Receipt, Calendar } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

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
    return <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Facturen</h1>
        <p className="text-sm text-muted-foreground">Bekijk uw facturen en betalingsstatus</p>
      </div>

      {!invoices?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Receipt className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">Geen facturen beschikbaar</p>
            <p className="text-sm">Er zijn nog geen facturen voor u beschikbaar.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {invoices.map((inv) => {
            const items = (inv.items ?? []) as InvoiceItem[];
            return (
              <Card key={inv.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{inv.invoice_number ?? "Factuur"}</CardTitle>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {inv.issued_at
                          ? format(new Date(inv.issued_at), "d MMMM yyyy", { locale: nl })
                          : format(new Date(inv.created_at), "d MMMM yyyy", { locale: nl })}
                        {inv.due_at && (
                          <span className="ml-2">· Vervaldatum {format(new Date(inv.due_at), "d MMM yyyy", { locale: nl })}</span>
                        )}
                      </p>
                    </div>
                    <Badge variant="secondary" className={statusColors[inv.status] ?? ""}>
                      {statusLabels[inv.status] ?? inv.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
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

                  <div className="flex justify-end">
                    <div className="w-48 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Subtotaal</span>
                        <span>€{(inv.subtotal ?? 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">BTW ({inv.vat_percentage}%)</span>
                        <span>€{(inv.vat_amount ?? 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-base border-t border-border pt-1">
                        <span>Totaal</span>
                        <span>€{(inv.total ?? 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {inv.paid_at && (
                    <div className="bg-accent/5 rounded-lg p-3 text-sm text-accent">
                      Betaald op {format(new Date(inv.paid_at), "d MMMM yyyy", { locale: nl })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PortalInvoicesPage;
