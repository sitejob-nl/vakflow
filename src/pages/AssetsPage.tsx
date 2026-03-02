import { useState, useMemo } from "react";
import { useAssets, useCreateAsset, useUpdateAsset, useDeleteAsset, useMaintenanceLogs, useCreateMaintenanceLog, useDeleteMaintenanceLog, type Asset, type MaintenanceLog } from "@/hooks/useAssets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Pencil, Trash2, History, Box, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import AssetDialog from "@/components/AssetDialog";
import { useAuth } from "@/contexts/AuthContext";

const statusColor: Record<string, string> = {
  actief: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  inactief: "bg-muted text-muted-foreground",
  "buiten dienst": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  afgevoerd: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const AssetsPage = () => {
  const { data: assets, isLoading } = useAssets();
  const createAsset = useCreateAsset();
  const updateAsset = useUpdateAsset();
  const deleteAsset = useDeleteAsset();
  const { user } = useAuth();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detailAsset, setDetailAsset] = useState<Asset | null>(null);

  // Maintenance log state
  const { data: logs } = useMaintenanceLogs(detailAsset?.id);
  const createLog = useCreateMaintenanceLog();
  const deleteLog = useDeleteMaintenanceLog();
  const [logDesc, setLogDesc] = useState("");
  const [logDate, setLogDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [deleteLogId, setDeleteLogId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!assets) return [];
    const q = search.toLowerCase();
    return assets.filter((a) =>
      [a.name, a.asset_type, a.brand, a.model, a.serial_number, a.customer?.name]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q))
    );
  }, [assets, search]);

  const handleSave = (data: Partial<Asset>) => {
    if (editing) {
      updateAsset.mutate({ id: editing.id, ...data }, { onSuccess: () => setDialogOpen(false) });
    } else {
      createAsset.mutate(data, { onSuccess: () => setDialogOpen(false) });
    }
  };

  const handleAddLog = () => {
    if (!detailAsset || !logDesc.trim()) return;
    createLog.mutate(
      { asset_id: detailAsset.id, description: logDesc, maintenance_date: logDate, performed_by: user?.id },
      { onSuccess: () => { setLogDesc(""); setLogDate(format(new Date(), "yyyy-MM-dd")); } }
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">Objecten</h1>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Object toevoegen
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Zoek op naam, type, merk..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Box className="mx-auto w-10 h-10 mb-2 opacity-40" />
          {search ? "Geen objecten gevonden" : "Nog geen objecten aangemaakt"}
        </CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Naam</TableHead>
                <TableHead className="hidden md:table-cell">Type</TableHead>
                <TableHead className="hidden md:table-cell">Merk / Model</TableHead>
                <TableHead className="hidden sm:table-cell">Klant</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((asset) => (
                <TableRow key={asset.id} className="cursor-pointer" onClick={() => setDetailAsset(asset)}>
                  <TableCell className="font-medium">{asset.name}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{asset.asset_type || "—"}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {[asset.brand, asset.model].filter(Boolean).join(" ") || "—"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{asset.customer?.name || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={statusColor[asset.status] || ""}>
                      {asset.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(asset); setDialogOpen(true); }}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteId(asset.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <AssetDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        asset={editing}
        onSave={handleSave}
        saving={createAsset.isPending || updateAsset.isPending}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Object verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>Dit verwijdert ook alle onderhoudshistorie. Dit kan niet ongedaan worden.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={() => { deleteAsset.mutate(deleteId!); setDeleteId(null); }}>Verwijderen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Detail Sheet */}
      <Sheet open={!!detailAsset} onOpenChange={(o) => !o && setDetailAsset(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {detailAsset && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Box className="w-5 h-5" /> {detailAsset.name}
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div className="text-muted-foreground">Type</div><div>{detailAsset.asset_type || "—"}</div>
                  <div className="text-muted-foreground">Merk</div><div>{detailAsset.brand || "—"}</div>
                  <div className="text-muted-foreground">Model</div><div>{detailAsset.model || "—"}</div>
                  <div className="text-muted-foreground">Serienummer</div><div>{detailAsset.serial_number || "—"}</div>
                  <div className="text-muted-foreground">Status</div>
                  <div><Badge variant="secondary" className={statusColor[detailAsset.status] || ""}>{detailAsset.status}</Badge></div>
                  <div className="text-muted-foreground">Klant</div><div>{detailAsset.customer?.name || "—"}</div>
                  <div className="text-muted-foreground">Adres</div>
                  <div>{detailAsset.address ? [detailAsset.address.street, detailAsset.address.house_number, detailAsset.address.city].filter(Boolean).join(" ") : "—"}</div>
                  <div className="text-muted-foreground">Installatiedatum</div>
                  <div>{detailAsset.install_date ? format(new Date(detailAsset.install_date), "d MMM yyyy", { locale: nl }) : "—"}</div>
                  <div className="text-muted-foreground">Volgende onderhoud</div>
                  <div>{detailAsset.next_maintenance_date ? format(new Date(detailAsset.next_maintenance_date), "d MMM yyyy", { locale: nl }) : "—"}</div>
                </div>
                {detailAsset.notes && (
                  <div className="text-sm"><span className="text-muted-foreground">Notities:</span> {detailAsset.notes}</div>
                )}

                {/* Maintenance History */}
                <div className="pt-2 border-t">
                  <h3 className="font-semibold flex items-center gap-1.5 mb-3">
                    <History className="w-4 h-4" /> Onderhoudshistorie
                  </h3>

                  <div className="flex gap-2 mb-3">
                    <Input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} className="w-36" />
                    <Input placeholder="Beschrijving..." value={logDesc} onChange={(e) => setLogDesc(e.target.value)} className="flex-1" />
                    <Button size="sm" onClick={handleAddLog} disabled={!logDesc.trim() || createLog.isPending}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>

                  {logs && logs.length > 0 ? (
                    <div className="space-y-2">
                      {logs.map((log) => (
                        <div key={log.id} className="flex items-start justify-between gap-2 text-sm bg-muted/50 rounded-md p-2.5">
                          <div>
                            <div className="font-medium">{log.description || "Onderhoud"}</div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(log.maintenance_date), "d MMM yyyy", { locale: nl })}
                              {log.profile?.full_name && ` • ${log.profile.full_name}`}
                              {log.work_order?.work_order_number && ` • ${log.work_order.work_order_number}`}
                            </div>
                          </div>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDeleteLogId(log.id)}>
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nog geen onderhoudshistorie</p>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete log confirmation */}
      <AlertDialog open={!!deleteLogId} onOpenChange={() => setDeleteLogId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Onderhoudslog verwijderen?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={() => { deleteLog.mutate(deleteLogId!); setDeleteLogId(null); }}>Verwijderen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AssetsPage;
