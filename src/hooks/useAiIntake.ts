import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface AiIntakeSuggestion {
  summary: string;
  work_order_type?: string;
  estimated_duration_minutes: number;
  suggested_service_id?: string | null;
  suggested_materials: {
    material_id: string;
    name: string;
    quantity: number;
    unit: string;
  }[];
  urgency: "laag" | "normaal" | "hoog" | "spoed";
  notes?: string;
}

export function useAiIntake() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suggestion, setSuggestion] = useState<AiIntakeSuggestion | null>(null);
  const { toast } = useToast();

  const analyze = async (complaint: string) => {
    if (!complaint || complaint.trim().length < 5) {
      toast({ title: "Voer een klachtomschrijving in (minimaal 5 tekens)", variant: "destructive" });
      return null;
    }
    setIsAnalyzing(true);
    setSuggestion(null);

    try {
      const { data, error } = await supabase.functions.invoke("ai-intake", {
        body: { complaint: complaint.trim() },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const s = data.suggestion as AiIntakeSuggestion;
      setSuggestion(s);
      return s;
    } catch (err: any) {
      toast({ title: "AI-analyse mislukt", description: err.message, variant: "destructive" });
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  };

  const clear = () => setSuggestion(null);

  return { analyze, isAnalyzing, suggestion, clear };
}
