import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ChevronLeft, ChevronRight, Check, AlertTriangle, Loader2, MapPin, Ruler, DoorOpen } from "lucide-react";
import { useAssets, useObjectRooms, type ObjectRoom } from "@/hooks/useAssets";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateAudit } from "@/hooks/useQualityAudits";
import { useCustomers } from "@/hooks/useCustomers";
import ScoreRing, { getScoreLabel, getScoreBadgeClass } from "./ScoreRing";
import {
  DEFAULT_CLEANING_CRITERIA, AUDIT_TYPES, ROOM_TYPE_ICONS,
  type CriterionScore, type RoomScoreInput, calcRoomScore, calcOverallScore,
} from "./auditConstants";

type Step = "config" | "scoring" | "summary";

interface Props {
  onComplete: (auditId: string) => void;
  onCancel: () => void;
}

const AuditCreateFlow = ({ onComplete, onCancel }: Props) => {
  const { user } = useAuth();
  const { data: assets } = useAssets();
  const { data: customers } = useCustomers();
  const createAudit = useCreateAudit();

  const [step, setStep] = useState<Step>("config");
  const [auditType, setAuditType] = useState("internal");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [roomScores, setRoomScores] = useState<RoomScoreInput[]>([]);
  const [activeRoomIdx, setActiveRoomIdx] = useState(0);

  const activeAssets = useMemo(
    () => (assets ?? []).filter((a) => a.status === "actief"),
    [assets]
  );

  const selectedAsset = activeAssets.find((a) => a.id === selectedAssetId);
  const { data: objectRooms } = useObjectRooms(selectedAssetId ?? undefined);

  const customerMap = useMemo(() => {
    const m = new Map<string, string>();
    (customers ?? []).forEach((c) => m.set(c.id, c.name));
    return m;
  }, [customers]);

  // Initialize room scores when rooms load
  useEffect(() => {
    if (!objectRooms || !selectedAssetId) return;
    if (objectRooms.length > 0) {
      setRoomScores(
        objectRooms.map((r: ObjectRoom) => ({
          room_id: r.id,
          room_name: r.name,
          room_type: r.room_type,
          criteria: (r.checklist && r.checklist.length > 0 ? r.checklist : DEFAULT_CLEANING_CRITERIA).map(
            (c: any) => ({ id: c.id, name: c.name, score: 0, max: 5, weight: c.weight ?? 1.0 })
          ),
          score: null,
          notes: "",
        }))
      );
    }
    setActiveRoomIdx(0);
  }, [objectRooms, selectedAssetId]);

  const hasRooms = objectRooms && objectRooms.length > 0;

  const scoredCount = roomScores.filter((r) => calcRoomScore(r.criteria) !== null).length;
  const overallScore = calcOverallScore(roomScores);

  const updateCriterion = (roomIdx: number, critIdx: number, score: number) => {
    setRoomScores((prev) => {
      const next = [...prev];
      const room = { ...next[roomIdx] };
      const criteria = [...room.criteria];
      // Toggle: click same value resets to 0
      criteria[critIdx] = { ...criteria[critIdx], score: criteria[critIdx].score === score ? 0 : score };
      room.criteria = criteria;
      room.score = calcRoomScore(criteria);
      next[roomIdx] = room;
      return next;
    });
  };

  const updateRoomNotes = (roomIdx: number, val: string) => {
    setRoomScores((prev) => {
      const next = [...prev];
      next[roomIdx] = { ...next[roomIdx], notes: val };
      return next;
    });
  };

  const handleSave = () => {
    if (!selectedAssetId) return;
    createAudit.mutate(
      {
        asset_id: selectedAssetId,
        auditor_id: user?.id || null,
        audit_date: new Date().toISOString().slice(0, 10),
        audit_type: auditType,
        overall_score: overallScore,
        notes: notes || null,
        status: "afgerond",
        room_scores: roomScores.map((rs) => ({
          room_id: rs.room_id,
          room_name: rs.room_name,
          criteria: rs.criteria,
          score: calcRoomScore(rs.criteria),
          notes: rs.notes || null,
        })),
      },
      { onSuccess: (id) => onComplete(id) }
    );
  };

  // ── Step: Config ──
  if (step === "config") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h2 className="text-xl font-bold">Nieuwe inspectie</h2>
        </div>

        {/* Audit type chips */}
        <div>
          <label className="text-sm font-medium mb-2 block">Type inspectie</label>
          <div className="flex gap-2 flex-wrap">
            {AUDIT_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setAuditType(t.value)}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                  auditType === t.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-foreground border-border hover:bg-muted"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Object selection */}
        <div>
          <label className="text-sm font-medium mb-2 block">Selecteer object</label>
          <div className="space-y-2 max-h-[40vh] overflow-y-auto">
            {activeAssets.map((asset) => {
              const isSelected = selectedAssetId === asset.id;
              const custName = asset.customer_id ? customerMap.get(asset.customer_id) : null;
              return (
                <Card
                  key={asset.id}
                  className={`cursor-pointer transition-all ${
                    isSelected ? "ring-2 ring-primary bg-primary/5" : "hover:bg-muted/50"
                  }`}
                  onClick={() => setSelectedAssetId(asset.id)}
                >
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{asset.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                        {custName && <span>{custName}</span>}
                        {asset.address && (
                          <span className="flex items-center gap-0.5">
                            <MapPin className="w-3 h-3" />
                            {[asset.address.street, asset.address.house_number, asset.address.city].filter(Boolean).join(" ")}
                          </span>
                        )}
                        {asset.surface_area && (
                          <span className="flex items-center gap-0.5">
                            <Ruler className="w-3 h-3" /> {asset.surface_area} m²
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Show rooms as tags when asset selected */}
        {selectedAssetId && hasRooms && (
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Ruimtes ({objectRooms.length})</label>
            <div className="flex flex-wrap gap-1.5">
              {objectRooms.map((r: ObjectRoom) => (
                <Badge key={r.id} variant="secondary" className="text-xs">
                  {ROOM_TYPE_ICONS[r.room_type ?? ""] ?? <DoorOpen className="w-3 h-3 mr-0.5" />}
                  {r.name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* No rooms warning */}
        {selectedAssetId && objectRooms && objectRooms.length === 0 && (
          <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  Dit object heeft nog geen ruimtes
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                  Voeg eerst ruimtes toe via Objectbeheer voordat je een inspectie kunt starten.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Textarea
          placeholder="Opmerkingen (optioneel)..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />

        <Button
          onClick={() => setStep("scoring")}
          disabled={!selectedAssetId || !hasRooms}
          className="w-full"
          size="lg"
        >
          Start inspectie ({objectRooms?.length ?? 0} ruimtes)
        </Button>
      </div>
    );
  }

  // ── Step: Scoring ──
  if (step === "scoring") {
    const room = roomScores[activeRoomIdx];
    if (!room) return null;
    const roomScore = calcRoomScore(room.criteria);

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setStep("config")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h2 className="text-lg font-bold">{selectedAsset?.name}</h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{scoredCount}/{roomScores.length} ruimtes beoordeeld</span>
            </div>
          </div>
        </div>

        <Progress value={(scoredCount / roomScores.length) * 100} className="h-2" />

        {/* Room tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {roomScores.map((r, i) => {
            const rs = calcRoomScore(r.criteria);
            const isActive = i === activeRoomIdx;
            return (
              <button
                key={i}
                onClick={() => setActiveRoomIdx(i)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-all flex-shrink-0 ${
                  isActive
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border hover:bg-muted"
                }`}
              >
                {rs !== null && (
                  <span className={rs >= 8 ? "text-emerald-400" : rs >= 6 ? "text-amber-400" : "text-red-400"}>
                    {rs >= 8 ? "✓" : rs >= 6 ? "~" : "✗"}
                  </span>
                )}
                {r.room_name}
              </button>
            );
          })}
        </div>

        {/* Room card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <span>{ROOM_TYPE_ICONS[room.room_type ?? ""] ?? "🏠"}</span>
                {room.room_name}
                {room.room_type && (
                  <span className="text-xs text-muted-foreground font-normal capitalize">{room.room_type}</span>
                )}
              </CardTitle>
              <div className="relative flex items-center justify-center" style={{ width: 48, height: 48 }}>
                <ScoreRing score={roomScore} size={48} strokeWidth={3} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {room.criteria.map((crit, critIdx) => (
              <div key={crit.id} className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium min-w-0 flex-1">{crit.name}</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((s) => {
                    const isActive = crit.score === s;
                    const color =
                      s <= 2 ? "bg-red-500 text-white" : s === 3 ? "bg-amber-500 text-white" : "bg-emerald-500 text-white";
                    return (
                      <button
                        key={s}
                        onClick={() => updateCriterion(activeRoomIdx, critIdx, s)}
                        className={`w-8 h-8 rounded-md text-xs font-bold transition-all ${
                          isActive
                            ? `${color} scale-110 shadow-md`
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <Textarea
              placeholder="Opmerking bij deze ruimte..."
              value={room.notes}
              onChange={(e) => updateRoomNotes(activeRoomIdx, e.target.value)}
              rows={2}
              className="mt-2"
            />
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between gap-2">
          <Button
            variant="outline"
            onClick={() => setActiveRoomIdx((i) => Math.max(0, i - 1))}
            disabled={activeRoomIdx === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Vorige
          </Button>
          {activeRoomIdx < roomScores.length - 1 ? (
            <Button onClick={() => setActiveRoomIdx((i) => i + 1)}>
              Volgende <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={() => setStep("summary")}>
              Bekijk resultaat <Check className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── Step: Summary ──
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setStep("scoring")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-xl font-bold">Resultaat</h2>
      </div>

      {/* Overall score */}
      <div className="flex flex-col items-center py-4">
        <div className="relative flex items-center justify-center" style={{ width: 96, height: 96 }}>
          <ScoreRing score={overallScore} size={96} strokeWidth={6} showLabel />
        </div>
        <p className="text-sm text-muted-foreground mt-2">{selectedAsset?.name} · {new Date().toLocaleDateString("nl-NL")}</p>
      </div>

      {/* Room breakdown */}
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <tbody>
              {roomScores.map((room, i) => {
                const rs = calcRoomScore(room.criteria);
                return (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-4 py-2.5">
                      <span className="mr-1.5">{ROOM_TYPE_ICONS[room.room_type ?? ""] ?? "🏠"}</span>
                      {room.room_name}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Badge variant="secondary" className={getScoreBadgeClass(rs)}>
                        {rs !== null ? rs.toFixed(1) : "—"}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={() => setStep("scoring")}>
          Aanpassen
        </Button>
        <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={handleSave} disabled={createAudit.isPending}>
          {createAudit.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
          Inspectie opslaan
        </Button>
      </div>
    </div>
  );
};

export default AuditCreateFlow;
