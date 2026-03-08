import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Car, Calendar, Fuel, Gauge, AlertTriangle, Wrench, ChevronRight, ChevronDown } from "lucide-react";
import { format, differenceInDays, isPast } from "date-fns";
import { nl } from "date-fns/locale";
import { useState } from "react";

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

interface VehicleWorkOrder {
  id: string;
  work_order_number: string | null;
  description: string | null;
  status: string;
  created_at: string;
  completed_at: string | null;
  work_order_type: string | null;
}

const statusLabels: Record<string, string> = {
  gepland: "Gepland",
  onderweg: "Onderweg",
  bezig: "Bezig",
  afgerond: "Afgerond",
  geannuleerd: "Geannuleerd",
  ingepland: "Ingepland",
};

const statusColors: Record<string, string> = {
  gepland: "bg-primary/10 text-primary",
  ingepland: "bg-primary/10 text-primary",
  onderweg: "bg-yellow-500/10 text-yellow-600",
  bezig: "bg-purple-500/10 text-purple-600",
  afgerond: "bg-green-500/10 text-green-600",
  geannuleerd: "bg-destructive/10 text-destructive",
};

const PortalVehiclesPage = () => {
  const { customerId } = usePortalAuth();
  const [expandedVehicle, setExpandedVehicle] = useState<string | null>(null);

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

  // Fetch work orders for expanded vehicle
  const { data: vehicleWorkOrders, isLoading: woLoading } = useQuery({
    queryKey: ["portal-vehicle-workorders", expandedVehicle],
    enabled: !!expandedVehicle,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_orders")
        .select("id, work_order_number, description, status, created_at, completed_at, work_order_type")
        .eq("vehicle_id", expandedVehicle!)
        .eq("customer_id", customerId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as VehicleWorkOrder[];
    },
  });

  const getApkStatus = (expiryDate: string | null) => {
    if (!expiryDate) return { label: "Onbekend", variant: "secondary" as const, urgent: false, daysLeft: null };
    const days = differenceInDays(new Date(expiryDate), new Date());
    if (isPast(new Date(expiryDate))) return { label: "Verlopen", variant: "destructive" as const, urgent: true, daysLeft: days };
    if (days <= 30) return { label: `Nog ${days} dagen`, variant: "destructive" as const, urgent: true, daysLeft: days };
    if (days <= 90) return { label: `Nog ${days} dagen`, variant: "default" as const, urgent: false, daysLeft: days };
    return { label: format(new Date(expiryDate), "d MMM yyyy", { locale: nl }), variant: "secondary" as const, urgent: false, daysLeft: days };
  };

  const toggleVehicle = (id: string) => {
    setExpandedVehicle(prev => prev === id ? null : id);
  };

  if (isLoading) {
    return <div className="space-y-4">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mijn voertuigen</h1>
        <p className="text-sm text-muted-foreground">Overzicht van uw voertuigen, APK-status en werkhistorie</p>
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
        <div className="space-y-4">
          {vehicles.map((v) => {
            const apk = getApkStatus(v.apk_expiry_date);
            const isExpanded = expandedVehicle === v.id;

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
                  {/* APK countdown */}
                  <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
                    <div className="flex items-center gap-2 text-sm">
                      {apk.urgent && <AlertTriangle className="h-4 w-4 text-destructive" />}
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">APK verloopt</span>
                    </div>
                    <Badge variant={apk.variant}>{apk.label}</Badge>
                  </div>

                  {/* APK progress bar */}
                  {apk.daysLeft !== null && apk.daysLeft > 0 && apk.daysLeft <= 365 && (
                    <div className="space-y-1">
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            apk.daysLeft <= 30 ? "bg-destructive" : apk.daysLeft <= 90 ? "bg-yellow-500" : "bg-green-500"
                          }`}
                          style={{ width: `${Math.min((apk.daysLeft / 365) * 100, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground text-right">
                        {apk.daysLeft} dagen resterend
                      </p>
                    </div>
                  )}

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

                  {/* Work order history toggle */}
                  <button
                    onClick={() => toggleVehicle(v.id)}
                    className="flex items-center gap-2 w-full text-sm font-medium text-primary hover:text-primary/80 transition-colors pt-2 border-t border-border"
                  >
                    <Wrench className="h-4 w-4" />
                    Werkhistorie
                    {isExpanded ? <ChevronDown className="h-4 w-4 ml-auto" /> : <ChevronRight className="h-4 w-4 ml-auto" />}
                  </button>

                  {/* Work order list */}
                  {isExpanded && (
                    <div className="space-y-2 pt-1">
                      {woLoading ? (
                        <div className="space-y-2">
                          {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                        </div>
                      ) : !vehicleWorkOrders?.length ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Geen werkbonnen voor dit voertuig</p>
                      ) : (
                        vehicleWorkOrders.map((wo) => (
                          <div key={wo.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 p-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{wo.work_order_number ?? "Werkbon"}</span>
                                {wo.work_order_type && (
                                  <span className="text-xs text-muted-foreground capitalize">{wo.work_order_type}</span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {wo.description || "Geen omschrijving"}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {format(new Date(wo.created_at), "d MMM yyyy", { locale: nl })}
                                {wo.completed_at && ` — afgerond ${format(new Date(wo.completed_at), "d MMM yyyy", { locale: nl })}`}
                              </p>
                            </div>
                            <Badge variant="secondary" className={`shrink-0 ${statusColors[wo.status] ?? ""}`}>
                              {statusLabels[wo.status] ?? wo.status}
                            </Badge>
                          </div>
                        ))
                      )}
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

export default PortalVehiclesPage;
