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

  const filtered = useMemo(() => {
    if (!vehicles) return [];
    const q = search.toLowerCase();
    return vehicles.filter(
      (v) =>
        v.license_plate.toLowerCase().includes(q) ||
        (v.brand ?? "").toLowerCase().includes(q) ||
        (v.model ?? "").toLowerCase().includes(q) ||
        (v.customers?.name ?? "").toLowerCase().includes(q)
    );
  }, [vehicles, search]);

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
    if (days < 0) return <Badge variant="destructive" className="text-[10px]">APK verlopen</Badge>;
    if (days <= 30) return <Badge variant="outline" className="text-[10px] border-warning text-warning"><AlertTriangle className="h-3 w-3 mr-1" />APK {days}d</Badge>;
    return null;
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold">Voertuigen</h1>
        <Button size="sm" onClick={() => { setEditVehicle(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Nieuw voertuig
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Zoek op kenteken, merk, klant..."
          className="pl-9"
        />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kenteken</TableHead>
              <TableHead>Voertuig</TableHead>
              <TableHead className="hidden md:table-cell">Klant</TableHead>
              <TableHead className="hidden md:table-cell">KM-stand</TableHead>
              <TableHead className="hidden md:table-cell">APK</TableHead>
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
                  <TableCell className="hidden md:table-cell text-muted-foreground">{v.customers?.name ?? "—"}</TableCell>
                  <TableCell className="hidden md:table-cell">{v.mileage_current ? `${v.mileage_current.toLocaleString()} km` : "—"}</TableCell>
                  <TableCell className="hidden md:table-cell">
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
