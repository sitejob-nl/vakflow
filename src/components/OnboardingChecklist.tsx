import { useOnboardingProgress } from "@/hooks/useOnboardingProgress";
import { useNavigation, type Page } from "@/hooks/useNavigation";
import { useAuth } from "@/contexts/AuthContext";
import { Progress } from "@/components/ui/progress";
import {
  Building2, Wrench, Users, Calendar, Mail,
  Check, ChevronRight, X, Sparkles,
} from "lucide-react";
import { useState } from "react";

const stepIcons: Record<string, typeof Building2> = {
  company: Building2,
  service: Wrench,
  customer: Users,
  appointment: Calendar,
  email: Mail,
};

const OnboardingChecklist = () => {
  const { onboardingCompleted } = useAuth();
  const { data, isLoading } = useOnboardingProgress();
  const { navigate } = useNavigation();
  const [dismissed, setDismissed] = useState(false);

  // Don't show if already completed, dismissed, loading, or no data
  if (onboardingCompleted || dismissed || isLoading || !data || data.allDone) return null;

  const progressPercent = Math.round((data.completedCount / data.totalSteps) * 100);

  return (
    <div className="bg-card border border-border rounded-lg shadow-card mb-5 overflow-hidden">
      {/* Header */}
      <div className="px-4 md:px-5 py-3 md:py-4 flex items-center gap-3 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] md:text-[15px] font-bold">Welkom! Stel je account in</h3>
            <button
              onClick={() => setDismissed(true)}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 -mr-1"
              aria-label="Sluiten"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <Progress value={progressPercent} className="h-2 flex-1" />
            <span className="text-[11px] font-bold text-muted-foreground whitespace-nowrap">
              {data.completedCount}/{data.totalSteps}
            </span>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="divide-y divide-border">
        {data.steps.map((step) => {
          const Icon = stepIcons[step.id] || Building2;
          return (
            <button
              key={step.id}
              onClick={() => !step.completed && navigate(step.page as Page)}
              disabled={step.completed}
              className={`w-full text-left px-4 md:px-5 py-3 flex items-center gap-3 transition-colors ${
                step.completed
                  ? "opacity-60"
                  : "hover:bg-muted/50 cursor-pointer"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                  step.completed
                    ? "bg-primary text-primary-foreground"
                    : "border-2 border-border text-muted-foreground"
                }`}
              >
                {step.completed ? (
                  <Check className="w-3.5 h-3.5" strokeWidth={3} />
                ) : (
                  <Icon className="w-3.5 h-3.5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-[13px] font-semibold ${step.completed ? "line-through text-muted-foreground" : ""}`}>
                  {step.label}
                </div>
                <div className="text-[11px] text-muted-foreground">{step.description}</div>
              </div>
              {!step.completed && (
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default OnboardingChecklist;
