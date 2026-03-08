import { useState, useMemo } from "react";
import { useAssets, type Asset } from "@/hooks/useAssets";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Truck, CalendarCheck, Loader2, AlertTriangle } from "lucide-react";
import { differenceInDays, format } from "date-fns";
import { nl } from "date-fns/locale";
import WorkOrderDialog from "@/components/WorkOrderDialog";

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

const ScheduleOverviewPage = () => {
  const { data: assets, isLoading } = useAssets();
  const [woDialogOpen, setWoDialogOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

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

  const overdueCount = useMemo(() => {
    return scheduledAssets.filter((a) => differenceInDays(new Date(a.next_service_due!), new Date()) < 0).length;
  }, [scheduledAssets]);

  const todayCount = useMemo(() => {
    return scheduledAssets.filter((a) => {
      const d = differenceInDays(new Date(a.next_service_due!), new Date());
      return d >= 0 && d <= 0;
    }).length;
  }, [scheduledAssets]);

  const handleInplannen = (asset: Asset) => {
    setSelectedAsset(asset);
    setWoDialogOpen(true);
  };

  const getStatusBadge = (nextDue: string) => {
    const days = differenceInDays(new Date(nextDue), new Date());
    if (days < 0) return { label: `${Math.abs(days)} dagen te laat`, variant: "destructive" as const, class: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" };
    if (days === 0) return { label: "Vandaag", variant: "default" as const, class: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" };
    if (days <= 3) return { label: `Over ${days} dagen`, variant: "secondary" as const, class: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" };
    return { label: `Over ${days} dagen`, variant: "secondary" as const, class: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" };
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

      <WorkOrderDialog
        open={woDialogOpen}
        onOpenChange={(o) => { setWoDialogOpen(o); if (!o) setSelectedAsset(null); }}
      />
    </div>
  );
};

export default ScheduleOverviewPage;
