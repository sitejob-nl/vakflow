import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAssets, useCreateAsset, useUpdateAsset, useDeleteAsset, useMaintenanceLogs, useCreateMaintenanceLog, useDeleteMaintenanceLog, type Asset, type MaintenanceLog } from "@/hooks/useAssets";
import { format as fmtDate } from "date-fns";
import { nl as nlLocale } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Pencil, Trash2, History, Box, Loader2, Building2, Truck, Package } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { nl } from "date-fns/locale";
import AssetDialog from "@/components/AssetDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useIndustryConfig } from "@/hooks/useIndustryConfig";
import { supabase } from "@/integrations/supabase/client";
import { subMonths } from "date-fns";

const statusColor: Record<string, string> = {
  actief: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  inactief: "bg-muted text-muted-foreground",
  "buiten dienst": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  afgevoerd: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

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

const getDueBadge = (nextDue: string | null) => {
  if (!nextDue) return null;
  const days = differenceInDays(new Date(nextDue), new Date());
  if (days < 0) return { label: `${Math.abs(days)}d te laat`, class: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" };
  if (days <= 3) return { label: `Over ${days}d`, class: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" };
  return { label: format(new Date(nextDue), "d MMM", { locale: nl }), class: "bg-muted text-muted-foreground" };
};

const AssetsPage = () => {
  const { data: assets, isLoading } = useAssets();
  const createAsset = useCreateAsset();
  const updateAsset = useUpdateAsset();
  const deleteAsset = useDeleteAsset();
  const { user, companyId } = useAuth();
  const { industry } = useIndustryConfig();
  const isCleaning = industry === "cleaning";

  // Load custom field config (object types with fields)
  const { data: rawFieldConfig } = useQuery({
    queryKey: ["asset_field_config", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select("asset_field_config")
        .eq("id", companyId!)
        .single();
      return ((data?.asset_field_config ?? []) as unknown as any[]);
    },
    enabled: !!companyId,
  });

  // Normalize config: support both ObjectTypeDef[] and legacy flat FieldDef[]
  const objectTypes = useMemo(() => {
    if (!rawFieldConfig || rawFieldConfig.length === 0) return [] as Array<{ key: string; label: string; fields: Array<{ key: string; label: string; type: string; options?: string[] }> }>;
    if (rawFieldConfig[0]?.fields) return rawFieldConfig as Array<{ key: string; label: string; fields: Array<{ key: string; label: string; type: string; options?: string[] }> }>;
    return [{ key: "__legacy", label: "Overig", fields: rawFieldConfig as Array<{ key: string; label: string; type: string; options?: string[] }> }];
  }, [rawFieldConfig]);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
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

  // Material consumption for detail asset (last 3 months)
  const { data: assetMaterialCost } = useQuery({
    queryKey: ["asset-material-cost", detailAsset?.id],
    enabled: !!detailAsset?.id && isCleaning,
    queryFn: async () => {
      const threeMonthsAgo = subMonths(new Date(), 3).toISOString();
      const { data: wos } = await supabase
        .from("work_orders")
        .select("id")
        .eq("asset_id", detailAsset!.id)
        .gte("created_at", threeMonthsAgo);
      if (!wos?.length) return { total: 0, count: 0 };
      const woIds = wos.map((w) => w.id);
      const { data: mats } = await supabase
        .from("work_order_materials")
        .select("total, quantity")
        .in("work_order_id", woIds);
      const total = (mats ?? []).reduce((s, m) => s + (m.total || 0), 0);
      const count = (mats ?? []).reduce((s, m) => s + (m.quantity || 0), 0);
      return { total, count };
    },
  });

  const filtered = useMemo(() => {
    if (!assets) return [];
    let list = assets;
    if (isCleaning && typeFilter !== "all") {
      list = list.filter((a) => a.object_type === typeFilter);
    }
    const q = search.toLowerCase();
    if (q) {
      list = list.filter((a) =>
        [a.name, a.asset_type, a.brand, a.model, a.serial_number, a.customer?.name]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q))
      );
    }
    return list;
  }, [assets, search, typeFilter, isCleaning]);

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

      <div className="flex items-center gap-3 flex-wrap">
        {isCleaning && (
          <Tabs value={typeFilter} onValueChange={setTypeFilter}>
            <TabsList>
              <TabsTrigger value="all">Alle</TabsTrigger>
              <TabsTrigger value="building" className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" /> Panden
              </TabsTrigger>
              <TabsTrigger value="fleet" className="flex items-center gap-1">
                <Truck className="w-3.5 h-3.5" /> Wagenparken
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Zoek op naam, type, merk..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
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
                {isCleaning && <TableHead className="w-10" />}
                <TableHead>Naam</TableHead>
                <TableHead className="hidden md:table-cell">{isCleaning ? "Type" : "Type"}</TableHead>
                {!isCleaning && <TableHead className="hidden md:table-cell">Merk / Model</TableHead>}
                <TableHead className="hidden sm:table-cell">Klant</TableHead>
                {isCleaning && <TableHead className="hidden md:table-cell">Frequentie</TableHead>}
                {isCleaning && <TableHead className="hidden md:table-cell">Volgende beurt</TableHead>}
                {isCleaning && <TableHead className="hidden lg:table-cell">Score</TableHead>}
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((asset) => {
                const dueBadge = isCleaning ? getDueBadge(asset.next_service_due) : null;
                return (
                  <TableRow key={asset.id} className="cursor-pointer" onClick={() => setDetailAsset(asset)}>
                    {isCleaning && (
                      <TableCell>
                        {asset.object_type === "fleet" ? (
                          <Truck className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                        )}
                      </TableCell>
                    )}
                    <TableCell className="font-medium">{asset.name}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">{asset.asset_type || "—"}</TableCell>
                    {!isCleaning && (
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {[asset.brand, asset.model].filter(Boolean).join(" ") || "—"}
                      </TableCell>
                    )}
                    <TableCell className="hidden sm:table-cell text-muted-foreground">{asset.customer?.name || "—"}</TableCell>
                    {isCleaning && (
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {FREQUENCY_LABELS[asset.frequency || ""] || "—"}
                      </TableCell>
                    )}
                    {isCleaning && (
                      <TableCell className="hidden md:table-cell">
                        {dueBadge ? (
                          <Badge variant="secondary" className={dueBadge.class}>{dueBadge.label}</Badge>
                        ) : "—"}
                      </TableCell>
                    )}
                    {isCleaning && (
                      <TableCell className="hidden lg:table-cell">
                        {(asset as any).avg_quality_score ? (
                          <Badge variant="secondary" className={
                            (asset as any).avg_quality_score >= 4 ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" :
                            (asset as any).avg_quality_score >= 3 ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" :
                            "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                          }>
                            {(asset as any).avg_quality_score?.toFixed(1)}
                          </Badge>
                        ) : "—"}
                      </TableCell>
                    )}
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
                );
              })}
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
                  {isCleaning && detailAsset.object_type === "fleet" ? <Truck className="w-5 h-5" /> : <Box className="w-5 h-5" />}
                  {detailAsset.name}
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div className="text-muted-foreground">Type</div><div>{detailAsset.asset_type || "—"}</div>
                  {isCleaning && (
                    <>
                      <div className="text-muted-foreground">Objecttype</div><div>{detailAsset.object_type === "fleet" ? "Wagenpark" : "Pand"}</div>
                      <div className="text-muted-foreground">Frequentie</div><div>{FREQUENCY_LABELS[detailAsset.frequency || ""] || "—"}</div>
                      {detailAsset.frequency_days && (
                        <>
                          <div className="text-muted-foreground">Vaste dagen</div>
                          <div>{detailAsset.frequency_days.map((d) => ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"][d]).join(", ")}</div>
                        </>
                      )}
                      {detailAsset.surface_area && (
                        <>
                          <div className="text-muted-foreground">Oppervlakte</div><div>{detailAsset.surface_area} m²</div>
                        </>
                      )}
                      {detailAsset.vehicle_count && (
                        <>
                          <div className="text-muted-foreground">Voertuigen</div><div>{detailAsset.vehicle_count}</div>
                        </>
                      )}
                    </>
                  )}
                  {!isCleaning && (
                    <>
                      <div className="text-muted-foreground">Merk</div><div>{detailAsset.brand || "—"}</div>
                      <div className="text-muted-foreground">Model</div><div>{detailAsset.model || "—"}</div>
                      <div className="text-muted-foreground">Serienummer</div><div>{detailAsset.serial_number || "—"}</div>
                    </>
                  )}
                  <div className="text-muted-foreground">Status</div>
                  <div><Badge variant="secondary" className={statusColor[detailAsset.status] || ""}>{detailAsset.status}</Badge></div>
                  <div className="text-muted-foreground">Klant</div><div>{detailAsset.customer?.name || "—"}</div>
                  <div className="text-muted-foreground">Adres</div>
                  <div>{detailAsset.address ? [detailAsset.address.street, detailAsset.address.house_number, detailAsset.address.city].filter(Boolean).join(" ") : "—"}</div>
                  <div className="text-muted-foreground">{isCleaning ? "Startdatum" : "Installatiedatum"}</div>
                  <div>{detailAsset.install_date ? format(new Date(detailAsset.install_date), "d MMM yyyy", { locale: nl }) : "—"}</div>
                  <div className="text-muted-foreground">Volgende beurt</div>
                  <div>{detailAsset.next_service_due ? format(new Date(detailAsset.next_service_due), "d MMM yyyy", { locale: nl }) : "—"}</div>
                </div>
                {detailAsset.access_instructions && (
                  <div className="text-sm"><span className="text-muted-foreground">Toegang:</span> {detailAsset.access_instructions}</div>
                )}
                {detailAsset.notes && (
                  <div className="text-sm"><span className="text-muted-foreground">Notities:</span> {detailAsset.notes}</div>
                )}

                {/* Custom fields based on object type */}
                {(() => {
                  // Find matching object type fields for this asset
                  const assetTypeKey = detailAsset.asset_type || "";
                  let activeFields: Array<{ key: string; label: string; type: string }> = [];
                  const matchedType = objectTypes.find((ot) => ot.key === assetTypeKey);
                  if (matchedType) {
                    activeFields = matchedType.fields;
                  } else if (objectTypes.length === 1 && objectTypes[0].key === "__legacy") {
                    activeFields = objectTypes[0].fields;
                  }

                  if (activeFields.length === 0 || !detailAsset.custom_fields) return null;

                  const items = activeFields.map((fd) => {
                    const val = (detailAsset.custom_fields as any)?.[fd.key];
                    if (val === null || val === undefined || val === "") return null;
                    let display: string;
                    if (fd.type === "boolean") {
                      display = val ? "Ja" : "Nee";
                    } else if (fd.type === "date" && val) {
                      try {
                        display = fmtDate(new Date(val), "d MMM yyyy", { locale: nlLocale });
                      } catch {
                        display = String(val);
                      }
                    } else {
                      display = String(val);
                    }
                    return (
                      <div key={fd.key} className="contents">
                        <div className="text-muted-foreground">{fd.label}</div>
                        <div>{display}</div>
                      </div>
                    );
                  }).filter(Boolean);

                  if (items.length === 0) return null;

                  return (
                    <div className="pt-2 border-t">
                      <h3 className="font-semibold mb-2 text-sm">Extra velden</h3>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                        {items}
                      </div>
                    </div>
                  );
                })()}

                {/* Maintenance History */}
                <div className="pt-2 border-t">
                  <h3 className="font-semibold flex items-center gap-1.5 mb-3">
                    <History className="w-4 h-4" /> {isCleaning ? "Beurthistorie" : "Onderhoudshistorie"}
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
                    <p className="text-sm text-muted-foreground">{isCleaning ? "Nog geen beurthistorie" : "Nog geen onderhoudshistorie"}</p>
                  )}
                </div>

                {/* Material consumption (cleaning) */}
                {isCleaning && assetMaterialCost && (assetMaterialCost.total > 0 || assetMaterialCost.count > 0) && (
                  <div className="pt-2 border-t">
                    <h3 className="font-semibold flex items-center gap-1.5 mb-3">
                      <Package className="w-4 h-4" /> Materiaalverbruik (3 mnd)
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-muted/50 rounded-md p-3 text-center">
                        <div className="text-lg font-bold text-primary">€{assetMaterialCost.total.toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">Totale kosten</div>
                      </div>
                      <div className="bg-muted/50 rounded-md p-3 text-center">
                        <div className="text-lg font-bold">{assetMaterialCost.count}</div>
                        <div className="text-xs text-muted-foreground">Artikelen</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteLogId} onOpenChange={() => setDeleteLogId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log verwijderen?</AlertDialogTitle>
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
