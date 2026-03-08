import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CircleDot, MapPin, Snowflake, Sun, Car } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

interface TireSetWithVehicle {
  id: string;
  vehicle_id: string;
  season: string;
  brand: string | null;
  size: string | null;
  dot_code: string | null;
  tread_depth_fl: number | null;
  tread_depth_fr: number | null;
  tread_depth_rl: number | null;
  tread_depth_rr: number | null;
  location_code: string | null;
  status: string;
  notes: string | null;
  stored_at: string;
  vehicles?: {
    license_plate: string;
    brand: string | null;
    model: string | null;
  } | null;
}

const seasonIcons: Record<string, typeof Sun> = {
  zomer: Sun,
  winter: Snowflake,
  all_season: CircleDot,
};

const seasonLabels: Record<string, string> = {
  zomer: "Zomerbanden",
  winter: "Winterbanden",
  all_season: "All-season",
};

const PortalTireStoragePage = () => {
  const { customerId } = usePortalAuth();

  const { data: tireSets, isLoading } = useQuery({
    queryKey: ["portal-tire-storage", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      // First get customer vehicles, then tires for those vehicles
      const { data: vehicles, error: vErr } = await (supabase.from("vehicles" as any)
        .select("id") as any)
        .eq("customer_id", customerId!)
        .eq("status", "actief");
      if (vErr) throw vErr;
      const vehicleIds = (vehicles ?? []).map((v: any) => v.id);
      if (!vehicleIds.length) return [];

      const { data, error } = await (supabase.from("tire_storage" as any)
        .select("*, vehicles(license_plate, brand, model)") as any)
        .in("vehicle_id", vehicleIds)
        .eq("status", "opgeslagen")
        .order("stored_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TireSetWithVehicle[];
    },
  });

  const getTreadStatus = (depth: number | null) => {
    if (depth == null) return null;
    if (depth <= 1.6) return { label: "Onder minimum", color: "text-destructive" };
    if (depth <= 3) return { label: "Bijna versleten", color: "text-yellow-600" };
    return { label: "Goed", color: "text-green-600" };
  };

  const avgTread = (t: TireSetWithVehicle) => {
    const depths = [t.tread_depth_fl, t.tread_depth_fr, t.tread_depth_rl, t.tread_depth_rr].filter((d): d is number => d != null);
    if (!depths.length) return null;
    return depths.reduce((a, b) => a + b, 0) / depths.length;
  };

  if (isLoading) {
    return <div className="space-y-4">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bandenopslag</h1>
        <p className="text-sm text-muted-foreground">Overzicht van uw opgeslagen banden</p>
      </div>

      {!tireSets?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CircleDot className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">Geen banden opgeslagen</p>
            <p className="text-sm">Er zijn momenteel geen banden voor u opgeslagen.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {tireSets.map((tire) => {
            const SeasonIcon = seasonIcons[tire.season] || CircleDot;
            const avg = avgTread(tire);
            const treadStatus = avg != null ? getTreadStatus(avg) : null;

            return (
              <Card key={tire.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <SeasonIcon className="h-4 w-4" />
                        {seasonLabels[tire.season] || tire.season}
                      </CardTitle>
                      {tire.vehicles && (
                        <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Car className="h-3.5 w-3.5" />
                          {tire.vehicles.license_plate}
                          {tire.vehicles.brand && ` · ${tire.vehicles.brand}`}
                          {tire.vehicles.model && ` ${tire.vehicles.model}`}
                        </p>
                      )}
                    </div>
                    <Badge variant="secondary">Opgeslagen</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Brand & size */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {tire.brand && (
                      <div>
                        <p className="text-xs text-muted-foreground">Merk</p>
                        <p className="font-medium">{tire.brand}</p>
                      </div>
                    )}
                    {tire.size && (
                      <div>
                        <p className="text-xs text-muted-foreground">Maat</p>
                        <p className="font-medium">{tire.size}</p>
                      </div>
                    )}
                  </div>

                  {/* Tread depths */}
                  {avg != null && (
                    <div className="rounded-lg bg-muted/40 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Profieldiepte</span>
                        {treadStatus && (
                          <span className={`text-xs font-medium ${treadStatus.color}`}>{treadStatus.label}</span>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-center text-xs">
                        {[
                          { label: "LV", val: tire.tread_depth_fl },
                          { label: "RV", val: tire.tread_depth_fr },
                          { label: "LA", val: tire.tread_depth_rl },
                          { label: "RA", val: tire.tread_depth_rr },
                        ].map((pos) => (
                          <div key={pos.label}>
                            <p className="text-muted-foreground">{pos.label}</p>
                            <p className="font-mono font-medium">{pos.val != null ? `${pos.val}mm` : "—"}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Location & date */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    {tire.location_code && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        Locatie: {tire.location_code}
                      </span>
                    )}
                    <span>Opgeslagen: {format(new Date(tire.stored_at), "d MMM yyyy", { locale: nl })}</span>
                  </div>

                  {/* Notes */}
                  {tire.notes && (
                    <p className="text-xs text-muted-foreground bg-muted/30 rounded p-2">{tire.notes}</p>
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

export default PortalTireStoragePage;
