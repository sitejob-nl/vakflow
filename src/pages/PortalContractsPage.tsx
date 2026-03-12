import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollText, Calendar, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

const statusLabels: Record<string, string> = {
  actief: "Actief",
  gepauzeerd: "Gepauzeerd",
  beeindigd: "Beëindigd",
};

const statusColors: Record<string, string> = {
  actief: "bg-accent/10 text-accent",
  gepauzeerd: "bg-amber-500/10 text-amber-600",
  beeindigd: "bg-muted text-muted-foreground",
};

const frequencyLabels: Record<string, string> = {
  weekly: "Wekelijks",
  biweekly: "Tweewekelijks",
  monthly: "Maandelijks",
  quarterly: "Per kwartaal",
  yearly: "Jaarlijks",
};

const PortalContractsPage = () => {
  const { customerId } = usePortalAuth();

  const { data: contracts, isLoading } = useQuery({
    queryKey: ["portal-contracts", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("id, name, description, status, frequency, start_date, end_date, next_due_date, price, interval_months, services(name)")
        .eq("customer_id", customerId!)
        .order("status", { ascending: true })
        .order("next_due_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Contracten</h1>
        <p className="text-sm text-muted-foreground">Overzicht van uw servicecontracten</p>
      </div>

      {!contracts?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ScrollText className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">Geen contracten gevonden</p>
            <p className="text-sm">Er zijn nog geen contracten aan uw account gekoppeld.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {contracts.map((contract) => (
            <Card key={contract.id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <ScrollText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium">{contract.name}</p>
                      {contract.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{contract.description}</p>
                      )}
                      {contract.services && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Service: {(contract.services as any).name}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(contract.start_date), "d MMM yyyy", { locale: nl })}
                          {contract.end_date && ` – ${format(new Date(contract.end_date), "d MMM yyyy", { locale: nl })}`}
                        </span>

                        {contract.frequency && (
                          <span className="flex items-center gap-1">
                            <RefreshCw className="h-3 w-3" />
                            {frequencyLabels[contract.frequency] ?? `Elke ${contract.interval_months} maanden`}
                          </span>
                        )}

                        {contract.price > 0 && (
                          <span>€{contract.price.toFixed(2)} per beurt</span>
                        )}
                      </div>

                      {contract.next_due_date && contract.status === "actief" && (
                        <p className="text-xs text-primary mt-1.5">
                          Volgende beurt: {format(new Date(contract.next_due_date), "d MMMM yyyy", { locale: nl })}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge variant="secondary" className={statusColors[contract.status] ?? ""}>
                    {statusLabels[contract.status] ?? contract.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default PortalContractsPage;
