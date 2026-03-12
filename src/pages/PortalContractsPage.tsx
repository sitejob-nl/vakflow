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
    return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Contracten</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">Overzicht van uw servicecontracten</p>
      </div>

      {!contracts?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ScrollText className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-base font-medium">Geen contracten gevonden</p>
            <p className="text-sm">Er zijn nog geen contracten aan uw account gekoppeld.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {contracts.map((contract) => (
            <Card key={contract.id}>
              <CardContent className="p-3.5 sm:p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <ScrollText className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{contract.name}</p>
                      {contract.services && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">{(contract.services as any).name}</p>
                      )}
                      {contract.description && (
                        <p className="text-[11px] text-muted-foreground line-clamp-1">{contract.description}</p>
                      )}
                    </div>
                  </div>
                  <Badge variant="secondary" className={`text-[10px] shrink-0 ${statusColors[contract.status] ?? ""}`}>
                    {statusLabels[contract.status] ?? contract.status}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground mt-2 ml-[46px]">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(contract.start_date), "d MMM yyyy", { locale: nl })}
                  </span>
                  {contract.frequency && (
                    <span className="flex items-center gap-1">
                      <RefreshCw className="h-3 w-3" />
                      {frequencyLabels[contract.frequency] ?? `${contract.interval_months}m`}
                    </span>
                  )}
                  {contract.price > 0 && (
                    <span>€{contract.price.toFixed(2)}</span>
                  )}
                </div>

                {contract.next_due_date && contract.status === "actief" && (
                  <p className="text-[11px] text-primary mt-1 ml-[46px]">
                    Volgende: {format(new Date(contract.next_due_date), "d MMM yyyy", { locale: nl })}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default PortalContractsPage;
