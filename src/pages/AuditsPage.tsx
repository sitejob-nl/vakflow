import { useState, useMemo } from "react";
import { useAudits, useAudit, useDeleteAudit, type QualityAudit } from "@/hooks/useQualityAudits";
import { useAssets } from "@/hooks/useAssets";
import { useCustomers } from "@/hooks/useCustomers";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, ClipboardCheck, Loader2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import ScoreRing, { getScoreLabel, getScoreBadgeClass } from "@/components/audits/ScoreRing";
import { AUDIT_TYPES } from "@/components/audits/auditConstants";
import AuditCreateFlow from "@/components/audits/AuditCreateFlow";
import AuditDetailView from "@/components/audits/AuditDetailView";

type View = "list" | "create" | "detail";

const AuditsPage = () => {
  const { data: audits, isLoading } = useAudits();
  const { data: assets } = useAssets();
  const { data: customers } = useCustomers();
  const deleteAudit = useDeleteAudit();

  const [view, setView] = useState<View>("list");
  const [assetFilter, setAssetFilter] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: detailAudit } = useAudit(detailId);

  const customerMap = useMemo(() => {
    const m = new Map<string, string>();
    (customers ?? []).forEach((c) => m.set(c.id, c.name));
    return m;
  }, [customers]);

  const uniqueAssets = useMemo(() => {
    if (!audits) return [];
    const seen = new Map<string, string>();
    audits.forEach((a) => { if (a.asset?.name) seen.set(a.asset_id, a.asset.name); });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [audits]);

  const filtered = useMemo(() => {
    if (!audits) return [];
    let list = audits;
    if (assetFilter) list = list.filter((a) => a.asset_id === assetFilter);
    return list;
  }, [audits, assetFilter]);

  if (view === "create") {
    return (
      <AuditCreateFlow
        onComplete={(id) => { setDetailId(id); setView("detail"); }}
        onCancel={() => setView("list")}
      />
    );
  }

  if (view === "detail" && detailAudit) {
    return (
      <AuditDetailView
        audit={detailAudit}
        onBack={() => { setView("list"); setDetailId(null); }}
      />
    );
  }

  const typeLabel = (t: string) => AUDIT_TYPES.find((at) => at.value === t)?.label ?? t;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">Inspecties</h1>
        <Button onClick={() => setView("create")}>
          <Plus className="w-4 h-4 mr-1" /> Nieuwe inspectie
        </Button>
      </div>

      {/* Filter chips */}
      {uniqueAssets.length > 1 && (
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setAssetFilter(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
              !assetFilter ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"
            }`}
          >
            Alle
          </button>
          {uniqueAssets.map((a) => (
            <button
              key={a.id}
              onClick={() => setAssetFilter(assetFilter === a.id ? null : a.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                assetFilter === a.id ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"
              }`}
            >
              {a.name}
            </button>
          ))}
        </div>
      )}

      {/* Audit list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <ClipboardCheck className="mx-auto w-12 h-12 mb-3 opacity-30" />
            <p className="font-medium">Nog geen inspecties</p>
            <p className="text-sm mt-1">Start een nieuwe inspectie om de kwaliteit te meten.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((audit) => {
            const custName = audit.asset?.id && assets
              ? (() => {
                  const a = assets.find((x) => x.id === audit.asset_id);
                  return a?.customer_id ? customerMap.get(a.customer_id) : null;
                })()
              : null;

            return (
              <Card
                key={audit.id}
                className="cursor-pointer hover:bg-muted/30 transition-colors group"
                onClick={() => { setDetailId(audit.id); setView("detail"); }}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: 48, height: 48 }}>
                    <ScoreRing score={audit.overall_score ?? null} size={48} strokeWidth={3} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{audit.asset?.name}</span>
                      {custName && <span className="text-xs text-muted-foreground">· {custName}</span>}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <Badge variant="outline" className="text-[10px] h-5">{typeLabel(audit.audit_type)}</Badge>
                      <Badge variant="secondary" className={`text-[10px] h-5 ${getScoreBadgeClass(audit.overall_score ?? null)}`}>
                        {getScoreLabel(audit.overall_score ?? null)}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                      <span>{format(new Date(audit.audit_date), "d MMM yyyy", { locale: nl })}</span>
                      {audit.room_scores && <span>· {audit.room_scores.length} ruimtes</span>}
                      {audit.auditor?.full_name && <span>· {audit.auditor.full_name}</span>}
                    </div>
                    {audit.notes && (
                      <p className="text-xs text-muted-foreground italic mt-1 line-clamp-1">{audit.notes}</p>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100 flex-shrink-0"
                    onClick={(e) => { e.stopPropagation(); setDeleteId(audit.id); }}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Inspectie verwijderen?</AlertDialogTitle>
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
