import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import ScoreRing, { getScoreLabel, getScoreBadgeClass } from "./ScoreRing";
import { AUDIT_TYPES, ROOM_TYPE_ICONS, type CriterionScore } from "./auditConstants";
import type { QualityAudit } from "@/hooks/useQualityAudits";

interface Props {
  audit: QualityAudit;
  onBack: () => void;
}

const AuditDetailView = ({ audit, onBack }: Props) => {
  const typeLabel = AUDIT_TYPES.find((t) => t.value === audit.audit_type)?.label ?? audit.audit_type;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-xl font-bold">Inspectie detail</h2>
      </div>

      {/* Header card */}
      <Card>
        <CardContent className="p-5 flex items-center gap-5">
          <div className="relative flex items-center justify-center" style={{ width: 72, height: 72 }}>
            <ScoreRing score={audit.overall_score ?? null} size={72} strokeWidth={5} showLabel />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg">{audit.asset?.name}</h3>
            <div className="text-sm text-muted-foreground space-y-0.5">
              <p>{format(new Date(audit.audit_date), "d MMMM yyyy", { locale: nl })}</p>
              <p>Auditor: {audit.auditor?.full_name || "—"}</p>
            </div>
            <div className="flex gap-2 mt-2">
              <Badge variant="secondary">{typeLabel}</Badge>
              <Badge variant="secondary" className={getScoreBadgeClass(audit.overall_score ?? null)}>
                {getScoreLabel(audit.overall_score ?? null)}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {audit.notes && (
        <p className="text-sm italic text-muted-foreground px-1">{audit.notes}</p>
      )}

      {/* Room scores */}
      {audit.room_scores && audit.room_scores.map((rs) => {
        const criteria = (rs.criteria as unknown as CriterionScore[]) ?? [];
        return (
          <Card key={rs.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <span>{ROOM_TYPE_ICONS[(rs as any).room_type ?? ""] ?? "🏠"}</span>
                  {rs.room_name}
                </CardTitle>
                <Badge variant="secondary" className={getScoreBadgeClass(rs.score)}>
                  {rs.score !== null ? Number(rs.score).toFixed(1) : "—"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {criteria.map((c) => {
                const pct = c.score > 0 ? (c.score / (c.max || 5)) * 100 : 0;
                const barColor = c.score <= 2 ? "bg-red-500" : c.score === 3 ? "bg-amber-500" : "bg-emerald-500";
                return (
                  <div key={c.id} className="space-y-0.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{c.name}</span>
                      <span className="font-medium">{c.score > 0 ? `${c.score}/${c.max || 5}` : "—"}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {rs.notes && <p className="text-xs text-muted-foreground italic mt-1">{rs.notes}</p>}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default AuditDetailView;
