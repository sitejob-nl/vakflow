import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Car, Calendar, Fuel, Gauge, AlertTriangle } from "lucide-react";
import { format, differenceInDays, isPast } from "date-fns";
import { nl } from "date-fns/locale";

interface Vehicle {
  id: string;
  license_plate: string;
  brand: string | null;
  model: string | null;
  build_year: number | null;
  fuel_type: string | null;
  color: string | null;
  apk_expiry_date: string | null;
  mileage_current: number | null;
  status: string;
}

const PortalVehiclesPage = () => {
  const { customerId } = usePortalAuth();

  const { data: vehicles, isLoading } = useQuery({
    queryKey: ["portal-vehicles", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("vehicles" as any)
        .select("id, license_plate, brand, model, build_year, fuel_type, color, apk_expiry_date, mileage_current, status") as any)
        .eq("customer_id", customerId!)
        .eq("status", "actief")
        .order("license_plate");
      if (error) throw error;
      return (data ?? []) as Vehicle[];
    },
  });

  const getApkStatus = (expiryDate: string | null) => {
    if (!expiryDate) return { label: "Onbekend", variant: "secondary" as const, urgent: false };
    const days = differenceInDays(new Date(expiryDate), new Date());
    if (isPast(new Date(expiryDate))) return { label: "Verlopen", variant: "destructive" as const, urgent: true };
    if (days <= 30) return { label: `Nog ${days} dagen`, variant: "destructive" as const, urgent: true };
    if (days <= 90) return { label: `Nog ${days} dagen`, variant: "default" as const, urgent: false };
    return { label: format(new Date(expiryDate), "d MMM yyyy", { locale: nl }), variant: "secondary" as const, urgent: false };
  };

  if (isLoading) {
    return <div className="space-y-4">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mijn voertuigen</h1>
        <p className="text-sm text-muted-foreground">Overzicht van uw voertuigen en APK-data</p>
      </div>

      {!vehicles?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Car className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">Geen voertuigen gevonden</p>
            <p className="text-sm">Er zijn nog geen voertuigen aan uw account gekoppeld.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {vehicles.map((v) => {
            const apk = getApkStatus(v.apk_expiry_date);
            return (
              <Card key={v.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg font-mono tracking-wider">
                        {v.license_plate}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {[v.brand, v.model, v.build_year].filter(Boolean).join(" · ") || "Onbekend voertuig"}
                      </p>
                    </div>
                    <Car className="h-5 w-5 text-muted-foreground shrink-0" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* APK status */}
                  <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
                    <div className="flex items-center gap-2 text-sm">
                      {apk.urgent && <AlertTriangle className="h-4 w-4 text-destructive" />}
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">APK verloopt</span>
                    </div>
                    <Badge variant={apk.variant}>{apk.label}</Badge>
                  </div>

                  {/* Details */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {v.fuel_type && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Fuel className="h-3.5 w-3.5" />
                        <span className="capitalize">{v.fuel_type}</span>
                      </div>
                    )}
                    {v.color && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="h-3 w-3 rounded-full border" style={{ backgroundColor: v.color.toLowerCase() }} />
                        <span className="capitalize">{v.color}</span>
                      </div>
                    )}
                    {v.mileage_current != null && (
                      <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                        <Gauge className="h-3.5 w-3.5" />
                        <span>{v.mileage_current.toLocaleString("nl-NL")} km</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PortalVehiclesPage;
