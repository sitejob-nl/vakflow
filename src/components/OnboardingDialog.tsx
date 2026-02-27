import { useState, useEffect, forwardRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Wind, CalendarDays, Users, ClipboardList, ArrowRight, Sparkles, BookOpen, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const tourSteps = [
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
];

const accountingProviders = [
  { value: "eboekhouden", label: "e-Boekhouden" },
  { value: "exact", label: "Exact Online" },
  { value: "rompslomp", label: "Rompslomp" },
  { value: "moneybird", label: "Moneybird" },
  { value: null, label: "Geen / Later kiezen" },
];

const emailProviders = [
  { value: "smtp", label: "SMTP (eigen mailserver)" },
  { value: "outlook", label: "Outlook (Microsoft 365)" },
  { value: null, label: "Geen / Later kiezen" },
];

type Phase = "tour" | "accounting" | "email" | "done";

const OnboardingDialog = forwardRef<HTMLDivElement>((_props, ref) => {
  const { user, onboardingCompleted } = useAuth();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("tour");
  const [tourStep, setTourStep] = useState(0);
  const [selectedAccounting, setSelectedAccounting] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<string | null>("smtp");

  useEffect(() => {
    if (!user || onboardingCompleted === null) return;
    if (!onboardingCompleted) {
      setTimeout(() => setOpen(true), 600);
    }
  }, [user, onboardingCompleted]);

  const finish = async () => {
    setOpen(false);
    if (user) {
      // Save provider choices to company
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (profile?.company_id) {
        await supabase
          .from("companies")
          .update({
            accounting_provider: selectedAccounting,
            email_provider: selectedEmail,
          } as any)
          .eq("id", profile.company_id);
      }

      await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("id", user.id);
    }
  };

  const nextTour = () => {
    if (tourStep < tourSteps.length - 1) {
      setTourStep(tourStep + 1);
    } else {
      setPhase("accounting");
    }
  };

  if (onboardingCompleted === null || onboardingCompleted) return null;

  const renderTour = () => {
    const current = tourSteps[tourStep];
    const Icon = current.icon;
    return (
      <>
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
            {tourSteps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === tourStep ? "w-6 bg-primary" : "w-1.5 bg-muted"
                }`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1 text-muted-foreground" onClick={finish}>
              Overslaan
            </Button>
            <Button className="flex-1" onClick={nextTour}>
              Volgende
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </>
    );
  };

  const renderProviderChoice = (
    title: string,
    description: string,
    icon: React.ElementType,
    iconColor: string,
    iconBg: string,
    options: { value: string | null; label: string }[],
    selected: string | null,
    onSelect: (v: string | null) => void,
    onNext: () => void,
  ) => {
    const IconComp = icon;
    return (
      <>
        <div className={`${iconBg} flex items-center justify-center py-10 transition-colors duration-300`}>
          <div className="h-16 w-16 rounded-2xl bg-card shadow-md flex items-center justify-center">
            <IconComp className={`h-8 w-8 ${iconColor}`} />
          </div>
        </div>
        <div className="px-6 pb-6 pt-4 space-y-4">
          <div className="space-y-2 text-center">
            <h2 className="text-lg font-bold text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
          </div>
          <div className="space-y-2">
            {options.map((opt) => (
              <button
                key={opt.label}
                onClick={() => onSelect(opt.value)}
                className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all text-sm font-medium ${
                  selected === opt.value
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1 text-muted-foreground" onClick={finish}>
              Overslaan
            </Button>
            <Button className="flex-1" onClick={onNext}>
              Volgende
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </>
    );
  };

  const renderDone = () => (
    <>
      <div className="bg-primary/10 flex items-center justify-center py-10 transition-colors duration-300">
        <div className="h-16 w-16 rounded-2xl bg-card shadow-md flex items-center justify-center">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
      </div>
      <div className="px-6 pb-6 pt-4 space-y-4">
        <div className="space-y-2 text-center">
          <h2 className="text-lg font-bold text-foreground">Klaar om te starten!</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Je kunt je koppelingen altijd wijzigen via Instellingen. Veel succes!
          </p>
        </div>
        <Button className="w-full" onClick={finish}>
          Aan de slag!
        </Button>
      </div>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) finish(); }}>
      <DialogContent ref={ref} className="max-w-sm p-0 overflow-hidden border-border">
        {phase === "tour" && renderTour()}
        {phase === "accounting" &&
          renderProviderChoice(
            "Boekhoudpakket",
            "Welk boekhoudpakket gebruik je? We passen de koppelingen hierop aan.",
            BookOpen,
            "text-accent",
            "bg-accent/10",
            accountingProviders,
            selectedAccounting,
            setSelectedAccounting,
            () => setPhase("email"),
          )}
        {phase === "email" &&
          renderProviderChoice(
            "E-mail provider",
            "Hoe wil je e-mails versturen vanuit de app?",
            Mail,
            "text-primary",
            "bg-primary/10",
            emailProviders,
            selectedEmail,
            setSelectedEmail,
            () => setPhase("done"),
          )}
        {phase === "done" && renderDone()}
      </DialogContent>
    </Dialog>
  );
});

OnboardingDialog.displayName = "OnboardingDialog";

export default OnboardingDialog;
