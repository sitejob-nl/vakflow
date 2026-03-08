import { useState, useMemo } from "react";
import { useVehicles, useDeleteVehicle, type Vehicle } from "@/hooks/useVehicles";
import VehicleDialog from "@/components/VehicleDialog";
import { useNavigation } from "@/hooks/useNavigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Trash2, Pencil, Car, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInDays } from "date-fns";

const formatPlate = (plate: string) => {
  // Format as XX-XXX-XX style if 6+ chars
  const p = plate.replace(/[\s-]/g, "").toUpperCase();
  if (p.length === 6) return `${p.slice(0, 2)}-${p.slice(2, 5)}-${p.slice(5)}`;
  return p;
};

const VehiclesPage = () => {
  const { data: vehicles, isLoading } = useVehicles();
  const deleteVehicle = useDeleteVehicle();
  const { navigate } = useNavigation();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "apk">("name");

  const filtered = useMemo(() => {
    if (!vehicles) return [];
    const q = search.toLowerCase();
    let list = vehicles.filter(
      (v) =>
        v.license_plate.toLowerCase().includes(q) ||
        (v.brand ?? "").toLowerCase().includes(q) ||
        (v.model ?? "").toLowerCase().includes(q) ||
        (v.customers?.name ?? "").toLowerCase().includes(q)
    );
    if (sortBy === "apk") {
      list = [...list].sort((a, b) => {
        // Vehicles without APK date go to the end
        if (!a.apk_expiry_date && !b.apk_expiry_date) return 0;
        if (!a.apk_expiry_date) return 1;
        if (!b.apk_expiry_date) return -1;
        return new Date(a.apk_expiry_date).getTime() - new Date(b.apk_expiry_date).getTime();
      });
    }
    return list;
  }, [vehicles, search, sortBy]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteVehicle.mutateAsync(deleteId);
      toast({ title: "Voertuig verwijderd" });
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
    setDeleteId(null);
  };

  const apkStatus = (date: string | null) => {
    if (!date) return null;
    const days = differenceInDays(new Date(date), new Date());
    if (days < 0) return <Badge variant="destructive" className="text-[10px]">Verlopen ({Math.abs(days)}d)</Badge>;
    if (days <= 30) return <Badge variant="outline" className="text-[10px] border-destructive text-destructive bg-destructive/10"><AlertTriangle className="h-3 w-3 mr-1" />{days}d</Badge>;
    if (days <= 60) return <Badge variant="outline" className="text-[10px] border-warning text-warning">{days}d</Badge>;
    return null;
  };

  // Count vehicles with APK expiring within 30 days
  const apkWarningCount = useMemo(() => {
    if (!vehicles) return 0;
    return vehicles.filter((v) => {
      if (!v.apk_expiry_date) return false;
      const days = differenceInDays(new Date(v.apk_expiry_date), new Date());
      return days <= 30;
    }).length;
  }, [vehicles]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold">Voertuigen</h1>
        <Button size="sm" onClick={() => { setEditVehicle(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Nieuw voertuig
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Zoek op kenteken, merk, klant..."
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={sortBy === "name" ? "default" : "outline"}
            onClick={() => setSortBy("name")}
            className="text-xs"
          >
            Standaard
          </Button>
          <Button
            size="sm"
            variant={sortBy === "apk" ? "default" : "outline"}
            onClick={() => setSortBy("apk")}
            className="text-xs"
          >
            <AlertTriangle className="h-3 w-3 mr-1" />
            APK {apkWarningCount > 0 && <Badge variant="destructive" className="ml-1 text-[9px] px-1.5 py-0">{apkWarningCount}</Badge>}
          </Button>
        </div>
      </div>

      {/* Desktop table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kenteken</TableHead>
              <TableHead>Voertuig</TableHead>
              <TableHead>Klant</TableHead>
              <TableHead>KM-stand</TableHead>
              <TableHead>APK</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Laden...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Geen voertuigen gevonden</TableCell></TableRow>
            ) : (
              filtered.map((v) => (
                <TableRow
                  key={v.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate("vehDetail" as any, { id: v.id })}
                >
                  <TableCell className="font-mono font-bold text-[13px] tracking-wider">
                    <div className="flex items-center gap-2">
                      <Car className="h-4 w-4 text-muted-foreground" />
                      {formatPlate(v.license_plate)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{v.brand}</span>
                    {v.model && <span className="text-muted-foreground ml-1">{v.model}</span>}
                    {v.build_year && <span className="text-muted-foreground text-xs ml-1">({v.build_year})</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{v.customers?.name ?? "—"}</TableCell>
                  <TableCell>{v.mileage_current ? `${v.mileage_current.toLocaleString()} km` : "—"}</TableCell>
                  <TableCell>
                    {v.apk_expiry_date ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs">{format(new Date(v.apk_expiry_date), "dd-MM-yyyy")}</span>
                        {apkStatus(v.apk_expiry_date)}
                      </div>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditVehicle(v); setDialogOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(v.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-8 text-muted-foreground">Laden...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Geen voertuigen gevonden</div>
        ) : (
          filtered.map((v) => (
            <div
              key={v.id}
              onClick={() => navigate("vehDetail" as any, { id: v.id })}
              className="bg-card border border-border rounded-lg p-3.5 flex items-center gap-3 active:bg-muted/50 transition-colors cursor-pointer"
            >
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <Car className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-mono font-bold tracking-wider">{formatPlate(v.license_plate)}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {[v.brand, v.model, v.build_year ? `(${v.build_year})` : null].filter(Boolean).join(" ")}
                  {v.customers?.name ? ` · ${v.customers.name}` : ""}
                </div>
              </div>
              <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                {v.mileage_current && <span className="text-[10px] text-muted-foreground">{v.mileage_current.toLocaleString()} km</span>}
                {apkStatus(v.apk_expiry_date)}
              </div>
            </div>
          ))
        )}
      </div>

      <VehicleDialog open={dialogOpen} onOpenChange={setDialogOpen} vehicle={editVehicle} />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Voertuig verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>Dit kan niet ongedaan worden gemaakt.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Verwijderen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default VehiclesPage;
