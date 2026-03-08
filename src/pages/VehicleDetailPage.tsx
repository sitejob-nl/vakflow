import { useParams } from "react-router-dom";
import { useVehicle, useVehicleMileageLogs, useRdwLookup } from "@/hooks/useVehicles";
import { useWorkOrders } from "@/hooks/useWorkOrders";
import { useApkReminderSettings, useUpsertApkReminderSettings } from "@/hooks/useApkReminders";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Car, Calendar, Gauge, Fuel, Palette, Hash, FileText, ShieldAlert, ClipboardCheck, AlertTriangle, RefreshCw, Bell, Wrench } from "lucide-react";
import TireStorageCard from "@/components/TireStorageCard";
import { format, differenceInDays } from "date-fns";
import { nl } from "date-fns/locale";
import { useMemo, useEffect, useState } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { useNavigation } from "@/hooks/useNavigation";

const formatPlate = (plate: string) => {
  const p = plate.replace(/[\s-]/g, "").toUpperCase();
  if (p.length === 6) return `${p.slice(0, 2)}-${p.slice(2, 5)}-${p.slice(5)}`;
  return p;
};

const VehicleDetailPage = () => {
  const { id } = useParams();
  const { navigate } = useNavigation();
  const { data: vehicle, isLoading } = useVehicle(id);
  const { data: mileageLogs } = useVehicleMileageLogs(id);
  const { data: allWorkOrders } = useWorkOrders();
  const rdwLookup = useRdwLookup();
  const { data: apkSettings } = useApkReminderSettings();
  const upsertApk = useUpsertApkReminderSettings();

  // APK reminder local state
  const [apkEnabled, setApkEnabled] = useState(false);
  const [apkDaysBefore, setApkDaysBefore] = useState("30");

  useEffect(() => {
    if (apkSettings) {
      setApkEnabled(apkSettings.enabled);
      setApkDaysBefore(apkSettings.days_before?.[0]?.toString() ?? "30");
    }
  }, [apkSettings]);

  const handleApkToggle = async (enabled: boolean) => {
    setApkEnabled(enabled);
    await upsertApk.mutateAsync({
      enabled,
      days_before: [parseInt(apkDaysBefore)],
      channel: apkSettings?.channel ?? "email",
    });
  };

  const handleApkDaysChange = async (val: string) => {
    setApkDaysBefore(val);
    await upsertApk.mutateAsync({
      enabled: apkEnabled,
      days_before: [parseInt(val)],
      channel: apkSettings?.channel ?? "email",
    });
  };

  // Auto-fetch RDW data when vehicle loads
  useEffect(() => {
    if (vehicle?.license_plate && !rdwLookup.data && !rdwLookup.isPending) {
      rdwLookup.mutate(vehicle.license_plate);
    }
  }, [vehicle?.license_plate]);

  const vehicleWorkOrders = useMemo(() => {
    if (!allWorkOrders || !id) return [];
    return allWorkOrders
      .filter((wo: any) => wo.vehicle_id === id)
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [allWorkOrders, id]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!vehicle) {
    return <div className="text-center py-20 text-muted-foreground">Voertuig niet gevonden</div>;
  }

  const apkDays = vehicle.apk_expiry_date ? differenceInDays(new Date(vehicle.apk_expiry_date), new Date()) : null;
  const rdw = rdwLookup.data;

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
        <div className="ml-auto flex gap-2 flex-wrap justify-end">
          <Badge variant={vehicle.status === "actief" ? "default" : "secondary"}>{vehicle.status}</Badge>
          {apkDays !== null && apkDays < 0 && <Badge variant="destructive">APK verlopen</Badge>}
          {apkDays !== null && apkDays >= 0 && apkDays <= 30 && <Badge variant="outline" className="border-destructive text-destructive">APK {apkDays}d</Badge>}
          {apkDays !== null && apkDays > 30 && apkDays <= 90 && <Badge className="bg-orange-500/15 text-orange-600 border-orange-500/30">{apkDays}d tot APK</Badge>}
          {rdw?.has_open_recall && <Badge variant="destructive" className="flex items-center gap-1"><ShieldAlert className="h-3 w-3" />Terugroepactie</Badge>}
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Gauge className="h-3.5 w-3.5" />KM-stand</div>
            <p className="font-bold text-lg">{vehicle.mileage_current ? `${vehicle.mileage_current.toLocaleString()}` : "—"}</p>
            {vehicle.mileage_updated_at && <p className="text-[10px] text-muted-foreground">{format(new Date(vehicle.mileage_updated_at), "dd MMM yyyy", { locale: nl })}</p>}
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

      {/* Vehicle details */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Voertuiggegevens</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6 text-sm">
            {vehicle.vin && <><dt className="text-muted-foreground">VIN</dt><dd className="font-mono">{vehicle.vin}</dd></>}
            {vehicle.registration_date && <><dt className="text-muted-foreground">Eerste toelating</dt><dd>{format(new Date(vehicle.registration_date), "dd-MM-yyyy")}</dd></>}
            {vehicle.vehicle_mass && <><dt className="text-muted-foreground">Massa rijklaar</dt><dd>{vehicle.vehicle_mass} kg</dd></>}
            {vehicle.build_year && <><dt className="text-muted-foreground">Bouwjaar</dt><dd>{vehicle.build_year}</dd></>}
            {vehicle.fuel_type && <><dt className="text-muted-foreground">Brandstof</dt><dd>{vehicle.fuel_type}</dd></>}
          </dl>
          {vehicle.notes && <p className="mt-4 text-sm text-muted-foreground border-t border-border pt-3">{vehicle.notes}</p>}
        </CardContent>
      </Card>

      {/* APK Reminder Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Bell className="h-4 w-4" /> APK-herinnering
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Automatische herinnering</p>
              <p className="text-xs text-muted-foreground">Stuur een herinnering voordat de APK verloopt</p>
            </div>
            <Switch checked={apkEnabled} onCheckedChange={handleApkToggle} />
          </div>
          {apkEnabled && (
            <div className="mt-3 flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Herinner</span>
              <Select value={apkDaysBefore} onValueChange={handleApkDaysChange}>
                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="14">14 dagen</SelectItem>
                  <SelectItem value="30">30 dagen</SelectItem>
                  <SelectItem value="60">60 dagen</SelectItem>
                  <SelectItem value="90">90 dagen</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">vooraf</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recalls */}
      {rdw?.recalls && rdw.recalls.length > 0 && (
        <Card className={rdw.has_open_recall ? "border-destructive" : ""}>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              Terugroepacties ({rdw.recalls.length})
              {rdw.has_open_recall && <Badge variant="destructive" className="text-[10px]">Openstaand</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {rdw.recalls.map((recall, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b border-border last:border-b-0">
                  <div className="flex items-center gap-2">
                    {(recall.status === "O" || recall.status?.toLowerCase().includes("open")) ? (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    ) : (
                      <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm font-mono">{recall.ref_code || "—"}</span>
                  </div>
                  <Badge variant={recall.status === "O" ? "destructive" : "secondary"} className="text-[10px]">
                    {recall.status === "O" ? "Open" : recall.status === "H" ? "Hersteld" : recall.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* APK History */}
      {rdw?.inspections && rdw.inspections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" /> APK-historie ({rdw.inspections.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {rdw.inspections.map((insp, idx) => (
                <div key={idx} className="flex items-center justify-between py-1.5 text-sm border-b border-border last:border-b-0">
                  <span className="text-muted-foreground">Keuring {idx + 1}</span>
                  <span className="font-mono font-medium">
                    {insp.expiry_date ? format(new Date(insp.expiry_date), "dd MMM yyyy", { locale: nl }) : "—"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Defects */}
      {rdw?.defects && rdw.defects.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Geconstateerde gebreken ({rdw.defects.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {rdw.defects.map((defect, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b border-border last:border-b-0 gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{defect.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {defect.date ? format(new Date(defect.date), "dd MMM yyyy", { locale: nl }) : "—"}
                      {defect.count > 1 && ` · ${defect.count}×`}
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground shrink-0">{defect.defect_id}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* RDW loading state */}
      {rdwLookup.isPending && (
        <Card>
          <CardContent className="py-6 flex items-center justify-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> RDW keuringsdata ophalen…
          </CardContent>
        </Card>
      )}

      {!rdwLookup.isPending && vehicle.license_plate && (
        <Button variant="outline" size="sm" onClick={() => rdwLookup.mutate(vehicle.license_plate)} className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" /> RDW data vernieuwen
        </Button>
      )}

      {/* Mileage history chart */}
      {mileageLogs && mileageLogs.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Gauge className="h-4 w-4" /> KM-standenhistorie</CardTitle></CardHeader>
          <CardContent>
            {mileageLogs.length >= 2 ? (
              <div className="h-[240px] -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={[...mileageLogs].reverse().map((log) => ({
                      date: format(new Date(log.recorded_at), "dd MMM yy", { locale: nl }),
                      km: log.mileage,
                    }))}
                  >
                    <defs>
                      <linearGradient id="mileageGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                    <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", fontSize: "12px" }}
                      formatter={(value: number) => [`${value.toLocaleString("nl-NL")} km`, "KM-stand"]}
                    />
                    <Area type="monotone" dataKey="km" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#mileageGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : null}

            <div className={`space-y-1 ${mileageLogs.length >= 2 ? "mt-4 pt-4 border-t border-border" : ""}`}>
              <p className="text-xs text-muted-foreground font-medium mb-2">Alle registraties ({mileageLogs.length})</p>
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

      {/* Tire storage */}
      <TireStorageCard vehicleId={id!} />

      {/* Work orders (maintenance history) */}
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Wrench className="h-4 w-4" /> Onderhoudshistorie ({vehicleWorkOrders.length})</CardTitle></CardHeader>
        <CardContent>
          {vehicleWorkOrders.length === 0 ? (
            <p className="text-muted-foreground text-sm">Geen werkorders voor dit voertuig</p>
          ) : (
            <div className="space-y-2">
              {vehicleWorkOrders.slice(0, 15).map((wo: any) => (
                <div
                  key={wo.id}
                  className="flex items-center justify-between py-2.5 border-b border-border last:border-b-0 cursor-pointer hover:bg-muted/30 rounded px-2 -mx-2 transition-colors"
                  onClick={() => navigate("woDetail" as any, { workOrderId: wo.id })}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{wo.work_order_number}</span>
                      {wo.work_order_type && (
                        <Badge variant="outline" className="text-[10px]">{wo.work_order_type}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {wo.created_at && format(new Date(wo.created_at), "dd MMM yyyy", { locale: nl })}
                      {wo.description && ` — ${wo.description.slice(0, 60)}`}
                    </p>
                  </div>
                  <Badge variant={wo.status === "afgerond" ? "default" : "secondary"} className="text-[10px] ml-2 shrink-0">{wo.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VehicleDetailPage;
