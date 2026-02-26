import { useState, useEffect, forwardRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Wind, CalendarDays, Users, ClipboardList, ArrowRight, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";


const steps = [
  {
    icon: Wind,
    title: "Welkom bij VentFlow! 👋",
    description: "Dé app voor het beheren van je ventilatie-onderhoud. Laten we je even rondleiden.",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    icon: CalendarDays,
    title: "Planning",
    description: "Plan afspraken in, bekijk je dagschema en navigeer direct naar klanten met Google Maps.",
    color: "text-accent",
    bg: "bg-accent/10",
  },
  {
    icon: Users,
    title: "Klanten",
    description: "Beheer al je klantgegevens, adressen en contactinfo op één plek.",
    color: "text-purple-500",
    bg: "bg-purple/10",
  },
  {
    icon: ClipboardList,
    title: "Werkbonnen",
    description: "Maak werkbonnen aan, vul checklists in, upload foto's en laat digitaal tekenen.",
    color: "text-cyan-500",
    bg: "bg-cyan/10",
  },
  {
    icon: Sparkles,
    title: "Klaar om te starten!",
    description: "Je kunt altijd het menu gebruiken om te navigeren. Veel succes!",
    color: "text-primary",
    bg: "bg-primary/10",
  },
];

const OnboardingDialog = forwardRef<HTMLDivElement>((_props, ref) => {
  const { user, onboardingCompleted } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!user || onboardingCompleted === null) return;
    if (!onboardingCompleted) {
      setTimeout(() => setOpen(true), 600);
    }
  }, [user, onboardingCompleted]);

  const finish = async () => {
    setOpen(false);
    if (user) {
      await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("id", user.id);
    }
  };

  const next = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      finish();
    }
  };

  if (onboardingCompleted === null || onboardingCompleted) return null;

  const current = steps[step];
  const Icon = current.icon;
  const isLast = step === steps.length - 1;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) finish(); }}>
      <DialogContent ref={ref} className="max-w-sm p-0 overflow-hidden border-border">
        <div className={`${current.bg} flex items-center justify-center py-10 transition-colors duration-300`}>
          <div className="h-16 w-16 rounded-2xl bg-card shadow-md flex items-center justify-center">
            <Icon className={`h-8 w-8 ${current.color}`} />
          </div>
        </div>

        <div className="px-6 pb-6 pt-4 space-y-4">
          <div className="space-y-2 text-center">
            <h2 className="text-lg font-bold text-foreground">{current.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{current.description}</p>
          </div>

          <div className="flex justify-center gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? "w-6 bg-primary" : "w-1.5 bg-muted"
                }`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            {!isLast && (
              <Button variant="ghost" className="flex-1 text-muted-foreground" onClick={finish}>
                Overslaan
              </Button>
            )}
            <Button className="flex-1" onClick={next}>
              {isLast ? "Aan de slag!" : "Volgende"}
              {!isLast && <ArrowRight className="h-4 w-4 ml-1" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});

OnboardingDialog.displayName = "OnboardingDialog";

export default OnboardingDialog;
