import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Clock, Package, AlertTriangle, Check, X } from "lucide-react";
import { useAiIntake, type AiIntakeSuggestion } from "@/hooks/useAiIntake";

interface Props {
  onApply: (suggestion: AiIntakeSuggestion) => void;
  onClose: () => void;
}

const urgencyColors: Record<string, string> = {
  laag: "bg-muted text-muted-foreground",
  normaal: "bg-primary/10 text-primary",
  hoog: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  spoed: "bg-destructive/10 text-destructive",
};

const typeLabels: Record<string, string> = {
  apk: "APK",
  kleine_beurt: "Kleine beurt",
  grote_beurt: "Grote beurt",
  storing: "Storing / reparatie",
  bandenwissel: "Bandenwissel",
  aflevering: "Aflevering",
  overig: "Overig",
};

export default function AiIntakePanel({ onApply, onClose }: Props) {
  const [complaint, setComplaint] = useState("");
  const { analyze, isAnalyzing, suggestion, clear } = useAiIntake();

  const handleAnalyze = () => analyze(complaint);

  const handleApply = () => {
    if (suggestion) {
      onApply(suggestion);
    }
  };

  return (
    <div className="space-y-3">
      {/* Input */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-primary" />
          AI Intake — klacht analyseren
        </div>
        <Textarea
          value={complaint}
          onChange={(e) => setComplaint(e.target.value)}
          placeholder="Beschrijf de klacht van de klant... bijv. 'Auto maakt raar geluid bij het remmen, trilt bij hogere snelheden'"
          rows={3}
          disabled={isAnalyzing}
        />
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handleAnalyze}
            disabled={isAnalyzing || complaint.trim().length < 5}
          >
            {isAnalyzing ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            )}
            {isAnalyzing ? "Analyseren..." : "Analyseer"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Result */}
      {suggestion && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3 text-sm animate-in fade-in-0 slide-in-from-top-2">
          {/* Summary */}
          <p className="font-medium">{suggestion.summary}</p>

          {/* Badges row */}
          <div className="flex flex-wrap gap-1.5">
            {suggestion.work_order_type && (
              <Badge variant="outline" className="text-xs">
                {typeLabels[suggestion.work_order_type] ?? suggestion.work_order_type}
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              <Clock className="mr-1 h-3 w-3" />
              {suggestion.estimated_duration_minutes} min
            </Badge>
            <Badge className={`text-xs ${urgencyColors[suggestion.urgency] ?? ""}`}>
              {suggestion.urgency === "hoog" || suggestion.urgency === "spoed" ? (
                <AlertTriangle className="mr-1 h-3 w-3" />
              ) : null}
              {suggestion.urgency}
            </Badge>
          </div>

          {/* Materials */}
          {suggestion.suggested_materials.length > 0 && (
            <div>
              <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
                <Package className="h-3 w-3" /> Benodigde materialen
              </div>
              <ul className="space-y-0.5">
                {suggestion.suggested_materials.map((m, i) => (
                  <li key={i} className="text-xs text-foreground">
                    {m.quantity}× {m.name} ({m.unit})
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Notes */}
          {suggestion.notes && (
            <p className="text-xs text-muted-foreground italic">{suggestion.notes}</p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button type="button" size="sm" onClick={handleApply}>
              <Check className="mr-1.5 h-3.5 w-3.5" /> Voorstel overnemen
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={clear}>
              Opnieuw
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
