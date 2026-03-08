import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star, ChevronRight, ChevronLeft, Loader2 } from "lucide-react";
import { useAssets } from "@/hooks/useAssets";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useCreateAudit, AUDIT_DEFAULT_CRITERIA, type CriterionScore } from "@/hooks/useQualityAudits";
import { format } from "date-fns";

interface RoomScore {
  room_id: string | null;
  room_name: string;
  criteria: CriterionScore[];
  notes: string;
}

const StarRating = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((s) => (
      <button key={s} type="button" onClick={() => onChange(s)} className="p-0.5">
        <Star
          className={`w-5 h-5 transition-colors ${s <= value ? "fill-primary text-primary" : "text-muted-foreground/30"}`}
        />
      </button>
    ))}
  </div>
);

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AuditDialog = ({ open, onOpenChange }: Props) => {
  const { user, companyId } = useAuth();
  const { data: assets } = useAssets();
  const createAudit = useCreateAudit();

  const [step, setStep] = useState(0);
  const [assetId, setAssetId] = useState("");
  const [auditDate, setAuditDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [auditType, setAuditType] = useState("internal");
  const [notes, setNotes] = useState("");
  const [roomScores, setRoomScores] = useState<RoomScore[]>([]);

  // Fetch rooms for selected asset
  const { data: rooms } = useQuery({
    queryKey: ["object_rooms", assetId],
    queryFn: async () => {
      const { data } = await supabase
        .from("object_rooms" as any)
        .select("id, name, sort_order")
        .eq("asset_id", assetId)
        .order("sort_order");
      return (data || []) as Array<{ id: string; name: string; sort_order: number }>;
    },
    enabled: !!assetId,
  });

  // Initialize room scores when rooms load
  useEffect(() => {
    if (rooms && rooms.length > 0) {
      setRoomScores(
        rooms.map((r) => ({
          room_id: r.id,
          room_name: r.name,
          criteria: AUDIT_DEFAULT_CRITERIA.map((c) => ({ name: c, score: 0, photo_url: null })),
          notes: "",
        }))
      );
    } else if (rooms && rooms.length === 0 && assetId) {
      // No rooms defined — create a single "Algemeen" entry
      setRoomScores([
        {
          room_id: null,
          room_name: "Algemeen",
          criteria: AUDIT_DEFAULT_CRITERIA.map((c) => ({ name: c, score: 0, photo_url: null })),
          notes: "",
        },
      ]);
    }
  }, [rooms, assetId]);

  const activeAssets = useMemo(() => (assets || []).filter((a) => a.status === "actief"), [assets]);

  const updateCriterionScore = (roomIdx: number, critIdx: number, score: number) => {
    setRoomScores((prev) => {
      const next = [...prev];
      const room = { ...next[roomIdx] };
      const criteria = [...room.criteria];
      criteria[critIdx] = { ...criteria[critIdx], score };
      room.criteria = criteria;
      next[roomIdx] = room;
      return next;
    });
  };

  const updateRoomNotes = (roomIdx: number, notes: string) => {
    setRoomScores((prev) => {
      const next = [...prev];
      next[roomIdx] = { ...next[roomIdx], notes };
      return next;
    });
  };

  const calcRoomScore = (criteria: CriterionScore[]) => {
    const scored = criteria.filter((c) => c.score > 0);
    return scored.length > 0 ? scored.reduce((s, c) => s + c.score, 0) / scored.length : null;
  };

  const overallScore = useMemo(() => {
    const scores = roomScores.map((r) => calcRoomScore(r.criteria)).filter((s): s is number => s !== null);
    return scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null;
  }, [roomScores]);

  const handleSave = (asDraft: boolean) => {
    createAudit.mutate(
      {
        asset_id: assetId,
        auditor_id: user?.id || null,
        audit_date: auditDate,
        audit_type: auditType,
        overall_score: overallScore,
        notes: notes || null,
        status: asDraft ? "concept" : "afgerond",
        room_scores: roomScores.map((rs) => ({
          room_id: rs.room_id,
          room_name: rs.room_name,
          criteria: rs.criteria,
          score: calcRoomScore(rs.criteria),
          notes: rs.notes || null,
        })),
      },
      { onSuccess: () => { onOpenChange(false); resetForm(); } }
    );
  };

  const resetForm = () => {
    setStep(0);
    setAssetId("");
    setAuditDate(format(new Date(), "yyyy-MM-dd"));
    setAuditType("internal");
    setNotes("");
    setRoomScores([]);
  };

  const scoreColor = (score: number | null) => {
    if (!score) return "text-muted-foreground";
    if (score >= 4) return "text-green-600 dark:text-green-400";
    if (score >= 3) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 0 ? "Nieuwe audit" : step <= roomScores.length ? `Ruimte: ${roomScores[step - 1]?.room_name}` : "Overzicht"}
          </DialogTitle>
        </DialogHeader>

        {/* Step 0: General info */}
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Object</label>
              <Select value={assetId} onValueChange={setAssetId}>
                <SelectTrigger><SelectValue placeholder="Selecteer object..." /></SelectTrigger>
                <SelectContent>
                  {activeAssets.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Datum</label>
                <Input type="date" value={auditDate} onChange={(e) => setAuditDate(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Type</label>
                <Select value={auditType} onValueChange={setAuditType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">Intern</SelectItem>
                    <SelectItem value="customer">Klant</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setStep(1)} disabled={!assetId}>
                Volgende <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Steps 1..N: Room scoring */}
        {step >= 1 && step <= roomScores.length && (() => {
          const roomIdx = step - 1;
          const room = roomScores[roomIdx];
          return (
            <div className="space-y-4">
              <div className="space-y-3">
                {room.criteria.map((crit, critIdx) => (
                  <div key={crit.name} className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium min-w-[80px]">{crit.name}</span>
                    <StarRating
                      value={crit.score}
                      onChange={(v) => updateCriterionScore(roomIdx, critIdx, v)}
                    />
                  </div>
                ))}
              </div>
              <Textarea
                placeholder="Opmerkingen bij deze ruimte..."
                value={room.notes}
                onChange={(e) => updateRoomNotes(roomIdx, e.target.value)}
                rows={2}
              />
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(step - 1)}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Vorige
                </Button>
                <Button onClick={() => setStep(step + 1)}>
                  {step < roomScores.length ? "Volgende ruimte" : "Overzicht"} <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          );
        })()}

        {/* Final step: Overview */}
        {step > roomScores.length && roomScores.length > 0 && (
          <div className="space-y-4">
            <div className="text-center py-3">
              <div className="text-sm text-muted-foreground">Totaalscore</div>
              <div className={`text-4xl font-extrabold font-mono ${scoreColor(overallScore)}`}>
                {overallScore?.toFixed(1) ?? "—"}
              </div>
              <div className="text-xs text-muted-foreground">/ 5.0</div>
            </div>
            <div className="space-y-2">
              {roomScores.map((room, i) => {
                const rs = calcRoomScore(room.criteria);
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-md cursor-pointer hover:bg-muted"
                    onClick={() => setStep(i + 1)}
                  >
                    <span className="text-sm font-medium">{room.room_name}</span>
                    <span className={`text-sm font-bold font-mono ${scoreColor(rs)}`}>
                      {rs?.toFixed(1) ?? "—"}
                    </span>
                  </div>
                );
              })}
            </div>
            <Textarea
              placeholder="Algemene opmerkingen..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setStep(roomScores.length)}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Terug
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleSave(true)} disabled={createAudit.isPending}>
                  Opslaan als concept
                </Button>
                <Button onClick={() => handleSave(false)} disabled={createAudit.isPending}>
                  {createAudit.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                  Afronden
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AuditDialog;
