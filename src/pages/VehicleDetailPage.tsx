import { useParams } from "react-router-dom";
import { useVehicle, useVehicleMileageLogs } from "@/hooks/useVehicles";
import { useWorkOrders } from "@/hooks/useWorkOrders";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Car, Calendar, Gauge, Fuel, Palette, Hash, FileText } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { nl } from "date-fns/locale";
import { useMemo } from "react";

const formatPlate = (plate: string) => {
  const p = plate.replace(/[\s-]/g, "").toUpperCase();
  if (p.length === 6) return `${p.slice(0, 2)}-${p.slice(2, 5)}-${p.slice(5)}`;
  return p;
};

const VehicleDetailPage = () => {
  const { id } = useParams();
  const { data: vehicle, isLoading } = useVehicle(id);
  const { data: mileageLogs } = useVehicleMileageLogs(id);
  const { data: allWorkOrders } = useWorkOrders();

  const vehicleWorkOrders = useMemo(() => {
    if (!allWorkOrders || !id) return [];
    return allWorkOrders.filter((wo: any) => wo.vehicle_id === id);
  }, [allWorkOrders, id]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!vehicle) {
    return <div className="text-center py-20 text-muted-foreground">Voertuig niet gevonden</div>;
  }

  const apkDays = vehicle.apk_expiry_date ? differenceInDays(new Date(vehicle.apk_expiry_date), new Date()) : null;

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
          <Car className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold font-mono tracking-wider">{formatPlate(vehicle.license_plate)}</h1>
          <p className="text-muted-foreground">
            {vehicle.brand} {vehicle.model}
            {vehicle.build_year && ` (${vehicle.build_year})`}
          </p>
          {vehicle.customers?.name && (
            <p className="text-sm text-muted-foreground mt-0.5">Klant: {vehicle.customers.name}</p>
          )}
        </div>
        <div className="ml-auto flex gap-2">
          <Badge variant={vehicle.status === "actief" ? "default" : "secondary"}>{vehicle.status}</Badge>
          {apkDays !== null && apkDays < 0 && <Badge variant="destructive">APK verlopen</Badge>}
          {apkDays !== null && apkDays >= 0 && apkDays <= 30 && <Badge variant="outline" className="border-warning text-warning">APK {apkDays}d</Badge>}
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Gauge className="h-3.5 w-3.5" />KM-stand</div>
            <p className="font-bold text-lg">{vehicle.mileage_current ? `${vehicle.mileage_current.toLocaleString()}` : "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Calendar className="h-3.5 w-3.5" />APK tot</div>
            <p className="font-bold text-lg">{vehicle.apk_expiry_date ? format(new Date(vehicle.apk_expiry_date), "dd-MM-yyyy") : "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Fuel className="h-3.5 w-3.5" />Brandstof</div>
            <p className="font-bold text-lg">{vehicle.fuel_type || "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Palette className="h-3.5 w-3.5" />Kleur</div>
            <p className="font-bold text-lg">{vehicle.color || "—"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Details */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Voertuiggegevens</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6 text-sm">
            {vehicle.vin && <><dt className="text-muted-foreground">VIN</dt><dd className="font-mono">{vehicle.vin}</dd></>}
            {vehicle.registration_date && <><dt className="text-muted-foreground">Eerste toelating</dt><dd>{format(new Date(vehicle.registration_date), "dd-MM-yyyy")}</dd></>}
            {vehicle.vehicle_mass && <><dt className="text-muted-foreground">Massa rijklaar</dt><dd>{vehicle.vehicle_mass} kg</dd></>}
          </dl>
          {vehicle.notes && <p className="mt-4 text-sm text-muted-foreground border-t border-border pt-3">{vehicle.notes}</p>}
        </CardContent>
      </Card>

      {/* Work orders */}
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4" /> Werkorders ({vehicleWorkOrders.length})</CardTitle></CardHeader>
        <CardContent>
          {vehicleWorkOrders.length === 0 ? (
            <p className="text-muted-foreground text-sm">Geen werkorders voor dit voertuig</p>
          ) : (
            <div className="space-y-2">
              {vehicleWorkOrders.slice(0, 10).map((wo: any) => (
                <div key={wo.id} className="flex items-center justify-between py-2 border-b border-border last:border-b-0">
                  <div>
                    <span className="font-medium text-sm">{wo.work_order_number}</span>
                    <span className="text-muted-foreground text-xs ml-2">{wo.description?.slice(0, 60) || "—"}</span>
                  </div>
                  <Badge variant={wo.status === "afgerond" ? "default" : "secondary"} className="text-[10px]">{wo.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mileage history */}
      {mileageLogs && mileageLogs.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Hash className="h-4 w-4" /> KM-standenhistorie</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1">
              {mileageLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between py-1.5 text-sm border-b border-border last:border-b-0">
                  <span className="text-muted-foreground">{format(new Date(log.recorded_at), "dd MMM yyyy HH:mm", { locale: nl })}</span>
                  <span className="font-mono font-medium">{log.mileage.toLocaleString()} km</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default VehicleDetailPage;
