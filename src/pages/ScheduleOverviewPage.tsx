import { useState, useMemo } from "react";
import { useAssets, type Asset } from "@/hooks/useAssets";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Building2, Truck, CalendarCheck, Loader2, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { differenceInDays, format, startOfWeek, addDays, isSameDay, addWeeks, subWeeks } from "date-fns";
import { nl } from "date-fns/locale";
import WorkOrderDialog from "@/components/WorkOrderDialog";
import { useIndustryConfig } from "@/hooks/useIndustryConfig";

const FREQUENCY_LABELS: Record<string, string> = {
  daily: "Dagelijks",
  "2x_week": "2x/week",
  "3x_week": "3x/week",
  weekly: "Wekelijks",
  biweekly: "2-wekelijks",
  monthly: "Maandelijks",
  quarterly: "Per kwartaal",
  yearly: "Jaarlijks",
};

const DAY_LABELS = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

const ScheduleOverviewPage = () => {
  const { data: assets, isLoading } = useAssets();
  const { data: teamMembers } = useTeamMembers();
  const { companyId } = useAuth();
  const { industry } = useIndustryConfig();
  const isCleaning = industry === "cleaning";
  const [woDialogOpen, setWoDialogOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);

  const currentWeekStart = useMemo(() => {
    const base = startOfWeek(new Date(), { weekStartsOn: 1 });
    return weekOffset === 0 ? base : addWeeks(base, weekOffset);
  }, [weekOffset]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  // Fetch work orders for the current week to show assignments
  const { data: weekWorkOrders } = useQuery({
    queryKey: ["week_work_orders", companyId, currentWeekStart.toISOString()],
    queryFn: async () => {
      const weekEnd = addDays(currentWeekStart, 7);
      const { data } = await supabase
        .from("work_orders")
        .select("id, customer_id, asset_id, assigned_to, status, scheduled_date, customers(name)")
        .eq("company_id", companyId!)
        .gte("scheduled_date", currentWeekStart.toISOString().split("T")[0])
        .lt("scheduled_date", weekEnd.toISOString().split("T")[0])
        .order("scheduled_date");
      return (data ?? []) as any[];
    },
    enabled: !!companyId,
  });

  // Assets with frequency_days scheduled for this week
  const scheduledAssets = useMemo(() => {
    if (!assets) return [];
    return assets
      .filter((a) => a.status === "actief" && a.next_service_due)
      .sort((a, b) => {
        const da = new Date(a.next_service_due!).getTime();
        const db = new Date(b.next_service_due!).getTime();
        return da - db;
      });
  }, [assets]);

  // Build the week grid: rows = team members, columns = days
  const weekGrid = useMemo(() => {
    if (!teamMembers || !assets) return [];
    return teamMembers.map((member) => {
      const days = weekDays.map((day) => {
        const dayStr = format(day, "yyyy-MM-dd");
        const dayOfWeek = day.getDay() === 0 ? 6 : day.getDay() - 1; // 0=Ma, 6=Zo

        // Work orders assigned to this member on this day
        const wos = (weekWorkOrders ?? []).filter((wo: any) =>
          wo.assigned_to === member.id && wo.scheduled_date === dayStr
        );

        // Assets with frequency_days matching this day of week, that might be assigned
        const frequencyAssets = assets.filter((a) =>
          a.status === "actief" &&
          a.frequency_days?.includes(dayOfWeek)
        );

        return { date: day, dayStr, wos, frequencyAssets };
      });
      return { member, days };
    });
  }, [teamMembers, weekDays, weekWorkOrders, assets]);

  const overdueCount = useMemo(() => {
    return scheduledAssets.filter((a) => differenceInDays(new Date(a.next_service_due!), new Date()) < 0).length;
  }, [scheduledAssets]);

  const todayCount = useMemo(() => {
    return scheduledAssets.filter((a) => {
      const d = differenceInDays(new Date(a.next_service_due!), new Date());
      return d === 0;
    }).length;
  }, [scheduledAssets]);

  const handleInplannen = (asset: Asset) => {
    setSelectedAsset(asset);
    setWoDialogOpen(true);
  };

  const getStatusBadge = (nextDue: string) => {
    const days = differenceInDays(new Date(nextDue), new Date());
    if (days < 0) return { label: `${Math.abs(days)} dagen te laat`, class: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" };
    if (days === 0) return { label: "Vandaag", class: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" };
    if (days <= 3) return { label: `Over ${days} dagen`, class: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" };
    return { label: `Over ${days} dagen`, class: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" };
  };

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarCheck className="w-6 h-6" /> Te plannen
        </h1>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground font-semibold uppercase">Achterstallig</div>
            <div className="text-2xl font-extrabold font-mono text-destructive">{overdueCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground font-semibold uppercase">Vandaag</div>
            <div className="text-2xl font-extrabold font-mono">{todayCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground font-semibold uppercase">Totaal ingepland</div>
            <div className="text-2xl font-extrabold font-mono">{scheduledAssets.length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue={isCleaning ? "week" : "list"}>
        <TabsList>
          {isCleaning && <TabsTrigger value="week">Weekoverzicht</TabsTrigger>}
          <TabsTrigger value="list">Lijst</TabsTrigger>
        </TabsList>

        {/* Week overview for cleaning */}
        {isCleaning && (
          <TabsContent value="week" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={() => setWeekOffset((o) => o - 1)}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Vorige week
              </Button>
              <span className="text-sm font-medium">
                {format(currentWeekStart, "d MMM", { locale: nl })} – {format(addDays(currentWeekStart, 6), "d MMM yyyy", { locale: nl })}
              </span>
              <div className="flex gap-2">
                {weekOffset !== 0 && (
                  <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)}>Vandaag</Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setWeekOffset((o) => o + 1)}>
                  Volgende week <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>

            {weekGrid.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">
                Geen teamleden gevonden. Voeg teamleden toe in Instellingen.
              </CardContent></Card>
            ) : (
              <Card className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[140px] sticky left-0 bg-card z-10">Medewerker</TableHead>
                      {weekDays.map((day, i) => (
                        <TableHead key={i} className={`min-w-[120px] text-center ${isSameDay(day, new Date()) ? "bg-primary/5" : ""}`}>
                          <div className="text-xs font-bold">{DAY_LABELS[i]}</div>
                          <div className="text-[10px] text-muted-foreground">{format(day, "d MMM", { locale: nl })}</div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {weekGrid.map(({ member, days }) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium text-sm sticky left-0 bg-card z-10">
                          {member.full_name ?? "Onbekend"}
                        </TableCell>
                        {days.map((cell, i) => {
                          const hasConflict = cell.wos.length > 1;
                          return (
                            <TableCell
                              key={i}
                              className={`p-1.5 align-top ${isSameDay(cell.date, new Date()) ? "bg-primary/5" : ""} ${hasConflict ? "ring-2 ring-inset ring-destructive/50 rounded" : ""}`}
                            >
                              <div className="space-y-1">
                                {cell.wos.map((wo: any) => (
                                  <div key={wo.id} className={`text-[10px] px-1.5 py-1 rounded ${
                                    wo.status === "afgerond" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" :
                                    wo.status === "bezig" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" :
                                    "bg-muted text-muted-foreground"
                                  }`}>
                                    {wo.customers?.name ?? "—"}
                                  </div>
                                ))}
                                {cell.wos.length === 0 && cell.frequencyAssets.length > 0 && (
                                  <div className="text-[10px] text-muted-foreground/50 italic px-1">
                                    {cell.frequencyAssets.length} object(en)
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>
        )}

        <TabsContent value="list" className="space-y-4 mt-4">
          {scheduledAssets.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <CalendarCheck className="mx-auto w-10 h-10 mb-2 opacity-40" />
              Geen objecten met geplande beurten
            </CardContent></Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Object</TableHead>
                    <TableHead className="hidden sm:table-cell">Klant</TableHead>
                    <TableHead className="hidden md:table-cell">Frequentie</TableHead>
                    <TableHead className="hidden md:table-cell">Laatste beurt</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scheduledAssets.map((asset) => {
                    const badge = getStatusBadge(asset.next_service_due!);
                    return (
                      <TableRow key={asset.id}>
                        <TableCell>
                          {asset.object_type === "fleet" ? (
                            <Truck className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <Building2 className="w-4 h-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{asset.name}</TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">{asset.customer?.name || "—"}</TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {FREQUENCY_LABELS[asset.frequency || ""] || "—"}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {asset.last_maintenance_date ? format(new Date(asset.last_maintenance_date), "d MMM yyyy", { locale: nl }) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={badge.class}>
                            {differenceInDays(new Date(asset.next_service_due!), new Date()) < 0 && (
                              <AlertTriangle className="w-3 h-3 mr-1 inline" />
                            )}
                            {badge.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => handleInplannen(asset)}>
                            Inplannen
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <WorkOrderDialog
        open={woDialogOpen}
        onOpenChange={(o) => { setWoDialogOpen(o); if (!o) setSelectedAsset(null); }}
      />
    </div>
  );
};

export default ScheduleOverviewPage;
