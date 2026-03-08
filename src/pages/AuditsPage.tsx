import { useState, useMemo } from "react";
import { useAudits, useAudit, useDeleteAudit, type QualityAudit } from "@/hooks/useQualityAudits";
import { useAssets } from "@/hooks/useAssets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Search, Trash2, ClipboardCheck, Loader2, Star, TrendingUp, TrendingDown, Minus, FileText } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import AuditDialog from "@/components/AuditDialog";
import FrequencyComplianceReport from "@/components/FrequencyComplianceReport";

const scoreColor = (score: number | null) => {
  if (!score) return "bg-muted text-muted-foreground";
  if (score >= 4) return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
  if (score >= 3) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
  return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
};

const statusBadge: Record<string, string> = {
  concept: "bg-muted text-muted-foreground",
  afgerond: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

const AuditsPage = () => {
  const { data: audits, isLoading } = useAudits();
  const { data: assets } = useAssets();
  const deleteAudit = useDeleteAudit();
  const [search, setSearch] = useState("");
  const [assetFilter, setAssetFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const { data: detailAudit } = useAudit(detailId);

  const activeAssets = useMemo(() => (assets ?? []).filter((a) => a.status === "actief"), [assets]);

  const filtered = useMemo(() => {
    if (!audits) return [];
    let list = audits;
    if (assetFilter !== "all") {
      list = list.filter((a) => a.asset_id === assetFilter);
    }
    const q = search.toLowerCase();
    if (q) {
      list = list.filter((a) =>
        [a.asset?.name, a.auditor?.full_name, a.status]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q))
      );
    }
    return list;
  }, [audits, search, assetFilter]);

  // Per-asset audit summary with trend
  const assetAuditSummary = useMemo(() => {
    if (!audits || !assets) return [];
    const map = new Map<string, { asset: any; audits: QualityAudit[] }>();
    for (const audit of audits) {
      if (audit.status !== "afgerond") continue;
      if (!map.has(audit.asset_id)) {
        map.set(audit.asset_id, { asset: audit.asset, audits: [] });
      }
      map.get(audit.asset_id)!.audits.push(audit);
    }
    return Array.from(map.values()).map(({ asset, audits: aList }) => {
      const sorted = aList.sort((a, b) => new Date(b.audit_date).getTime() - new Date(a.audit_date).getTime());
      const latest = sorted[0]?.overall_score ?? null;
      const previous = sorted[1]?.overall_score ?? null;
      let trend: "up" | "down" | "stable" | null = null;
      if (latest !== null && previous !== null) {
        if (latest > previous) trend = "up";
        else if (latest < previous) trend = "down";
        else trend = "stable";
      }
      return { assetId: asset?.id, assetName: asset?.name ?? "Onbekend", count: sorted.length, latestScore: latest, trend, lastDate: sorted[0]?.audit_date };
    }).sort((a, b) => (a.assetName).localeCompare(b.assetName));
  }, [audits, assets]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">Kwaliteit</h1>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> Nieuwe audit
        </Button>
      </div>

      <Tabs defaultValue="audits">
        <TabsList>
          <TabsTrigger value="audits">Audits</TabsTrigger>
          <TabsTrigger value="per-object">Per object</TabsTrigger>
          <TabsTrigger value="compliance">Frequentie-naleving</TabsTrigger>
        </TabsList>

        <TabsContent value="audits" className="space-y-4 mt-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Zoek op object, auditor..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={assetFilter} onValueChange={setAssetFilter}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Alle objecten" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle objecten</SelectItem>
                {activeAssets.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <ClipboardCheck className="mx-auto w-10 h-10 mb-2 opacity-40" />
              {search ? "Geen audits gevonden" : "Nog geen audits uitgevoerd"}
            </CardContent></Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Object</TableHead>
                    <TableHead className="hidden sm:table-cell">Datum</TableHead>
                    <TableHead className="hidden md:table-cell">Auditor</TableHead>
                    <TableHead className="hidden sm:table-cell">Type</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((audit) => (
                    <TableRow key={audit.id} className="cursor-pointer" onClick={() => setDetailId(audit.id)}>
                      <TableCell className="font-medium">{audit.asset?.name || "—"}</TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {format(new Date(audit.audit_date), "d MMM yyyy", { locale: nl })}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {audit.auditor?.full_name || "—"}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {audit.audit_type === "customer" ? "Klant" : "Intern"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={scoreColor(audit.overall_score)}>
                          {audit.overall_score?.toFixed(1) ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusBadge[audit.status] || ""}>
                          {audit.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); setDeleteId(audit.id); }}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* Per-object audit overview with trends */}
        <TabsContent value="per-object" className="space-y-4 mt-4">
          {assetAuditSummary.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <ClipboardCheck className="mx-auto w-10 h-10 mb-2 opacity-40" />
              Nog geen afgeronde audits
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {assetAuditSummary.map((item) => (
                <Card key={item.assetId} className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setAssetFilter(item.assetId!)}>
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{item.assetName}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.count} audit{item.count !== 1 ? "s" : ""}
                        {item.lastDate && ` · Laatst: ${format(new Date(item.lastDate), "d MMM yyyy", { locale: nl })}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.trend === "up" && <TrendingUp className="w-4 h-4 text-green-600" />}
                      {item.trend === "down" && <TrendingDown className="w-4 h-4 text-destructive" />}
                      {item.trend === "stable" && <Minus className="w-4 h-4 text-muted-foreground" />}
                      <Badge variant="secondary" className={scoreColor(item.latestScore)}>
                        {item.latestScore?.toFixed(1) ?? "—"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="compliance" className="mt-4">
          <FrequencyComplianceReport />
        </TabsContent>
      </Tabs>

      <AuditDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      {/* Detail Sheet */}
      <Sheet open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {detailAudit && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5" />
                  Audit: {detailAudit.asset?.name}
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div className="text-muted-foreground">Datum</div>
                  <div>{format(new Date(detailAudit.audit_date), "d MMM yyyy", { locale: nl })}</div>
                  <div className="text-muted-foreground">Type</div>
                  <div>{detailAudit.audit_type === "customer" ? "Klant" : "Intern"}</div>
                  <div className="text-muted-foreground">Auditor</div>
                  <div>{detailAudit.auditor?.full_name || "—"}</div>
                  <div className="text-muted-foreground">Status</div>
                  <div><Badge variant="secondary" className={statusBadge[detailAudit.status] || ""}>{detailAudit.status}</Badge></div>
                  <div className="text-muted-foreground">Totaalscore</div>
                  <div>
                    <Badge variant="secondary" className={scoreColor(detailAudit.overall_score)}>
                      {detailAudit.overall_score?.toFixed(1) ?? "—"} / 5.0
                    </Badge>
                  </div>
                </div>
                {detailAudit.notes && (
                  <div className="text-sm"><span className="text-muted-foreground">Opmerkingen:</span> {detailAudit.notes}</div>
                )}

                {/* Room scores */}
                {detailAudit.room_scores && detailAudit.room_scores.length > 0 && (
                  <div className="space-y-3 pt-2 border-t">
                    <h3 className="font-semibold text-sm">Scores per ruimte</h3>
                    {detailAudit.room_scores.map((rs: any) => (
                      <div key={rs.id} className="bg-muted/50 rounded-md p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{rs.room_name}</span>
                          <Badge variant="secondary" className={scoreColor(rs.score)}>
                            {rs.score?.toFixed(1) ?? "—"}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          {(rs.criteria as any[]).map((c: any) => (
                            <div key={c.name} className="flex items-center gap-2 text-xs">
                              <span className="text-muted-foreground">{c.name}</span>
                              <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <Star key={s} className={`w-3 h-3 ${s <= c.score ? "fill-primary text-primary" : "text-muted-foreground/20"}`} />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                        {rs.notes && <p className="text-xs text-muted-foreground">{rs.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}

                {/* PDF export placeholder */}
                <div className="pt-2 border-t">
                  <Button variant="outline" size="sm" className="w-full" disabled>
                    <FileText className="w-4 h-4 mr-1" /> Rapport genereren (binnenkort)
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Audit verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>Dit verwijdert ook alle scores. Dit kan niet ongedaan worden.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={() => { deleteAudit.mutate(deleteId!); setDeleteId(null); }}>Verwijderen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AuditsPage;
