import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Wrench, Calendar } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

const statusLabels: Record<string, string> = {
  actief: "Actief",
  inactief: "Inactief",
  onderhoud: "In onderhoud",
};

const statusColors: Record<string, string> = {
  actief: "bg-accent/10 text-accent",
  inactief: "bg-muted text-muted-foreground",
  onderhoud: "bg-primary/10 text-primary",
};

const PortalAssetsPage = () => {
  const { customerId } = usePortalAuth();

  const { data: assets, isLoading } = useQuery({
    queryKey: ["portal-assets", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select("id, name, object_type, status, brand, model, serial_number, next_service_due, last_maintenance_date, frequency, notes")
        .eq("customer_id", customerId!)
        .order("name");
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
        <h1 className="text-2xl font-bold tracking-tight">Objecten</h1>
        <p className="text-sm text-muted-foreground">Overzicht van uw objecten en onderhoudsstatus</p>
      </div>

      {!assets?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">Geen objecten gevonden</p>
            <p className="text-sm">Er zijn nog geen objecten aan uw account gekoppeld.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {assets.map((asset) => (
            <Card key={asset.id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium">{asset.name}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
                        {asset.brand && <span>{asset.brand} {asset.model ?? ""}</span>}
                        {asset.serial_number && <span>S/N: {asset.serial_number}</span>}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
                        {asset.last_maintenance_date && (
                          <span className="flex items-center gap-1">
                            <Wrench className="h-3 w-3" />
                            Laatste onderhoud: {format(new Date(asset.last_maintenance_date), "d MMM yyyy", { locale: nl })}
                          </span>
                        )}
                        {asset.next_service_due && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Volgend onderhoud: {format(new Date(asset.next_service_due), "d MMM yyyy", { locale: nl })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary" className={statusColors[asset.status] ?? ""}>
                    {statusLabels[asset.status] ?? asset.status}
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

export default PortalAssetsPage;
