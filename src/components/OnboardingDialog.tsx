import { useState, useEffect, forwardRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Wind, CalendarDays, Users, ClipboardList, ArrowRight, ArrowLeft,
  Sparkles, BookOpen, Mail, Building2, FileText, MapPin, BarChart3,
  UserPlus, Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

/* ── Types ─────────────────────────────────────────── */
type Phase =
  | "welcome"
  | "company"
  | "features"
  | "accounting"
  | "email"
  | "first-customer"
  | "done";

const PHASES: Phase[] = [
  "welcome",
  "company",
  "features",
  "accounting",
  "email",
  "first-customer",
  "done",
];

/* ── Feature tour slides ───────────────────────────── */
const featureSlides = [
  {
    icon: CalendarDays,
    title: "Planning & Afspraken",
    description: "Plan afspraken in, bekijk je dagschema per monteur en navigeer direct naar klanten met Google Maps. Optimaliseer routes voor efficiënte rijtijden.",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    icon: Users,
    title: "Klantenbeheer",
    description: "Beheer klantgegevens, meerdere adressen per klant, contactpersonen en onderhoudsintervallen. Alles op één plek.",
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
  {
    icon: ClipboardList,
    title: "Werkbonnen",
    description: "Maak werkbonnen aan met checklists, upload voor- en na-foto's, en laat klanten digitaal tekenen. Direct omzetten naar factuur.",
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
  },
  {
    icon: FileText,
    title: "Offertes & Facturen",
    description: "Stel professionele offertes en facturen op, verstuur als PDF en koppel met je boekhoudpakket voor automatische sync.",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  {
    icon: BarChart3,
    title: "Rapportages & Communicatie",
    description: "Krijg inzicht in omzet, werkbonnen en klantactiviteit. Stuur e-mails en WhatsApp-berichten direct vanuit de app.",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
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

/* ── Component ─────────────────────────────────────── */
const OnboardingDialog = forwardRef<HTMLDivElement>((_props, ref) => {
  const { user, onboardingCompleted, companyId } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("welcome");
  const [featureSlide, setFeatureSlide] = useState(0);

  // Company details
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [btwNumber, setBtwNumber] = useState("");
  const [iban, setIban] = useState("");

  // Provider choices
  const [selectedAccounting, setSelectedAccounting] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<string | null>("smtp");

  // First customer
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerCity, setCustomerCity] = useState("");
  const [customerPostalCode, setCustomerPostalCode] = useState("");

  useEffect(() => {
    if (!user || onboardingCompleted === null) return;
    if (!onboardingCompleted) {
      setTimeout(() => setOpen(true), 600);
    }
  }, [user, onboardingCompleted]);

  // Prefill company data
  useEffect(() => {
    if (!companyId) return;
    supabase
      .from("companies_safe" as any)
      .select("address, postal_code, city, phone, btw_number, iban")
      .eq("id", companyId)
      .single()
      .then(({ data }: { data: any }) => {
        if (!data) return;
        if (data.address) setAddress(data.address);
        if (data.postal_code) setPostalCode(data.postal_code);
        if (data.city) setCity(data.city);
        if (data.phone) setPhone(data.phone);
        if (data.btw_number) setBtwNumber(data.btw_number);
        if (data.iban) setIban(data.iban);
      });
  }, [companyId]);

  const currentIndex = PHASES.indexOf(phase);
  const progress = Math.round(((currentIndex + 1) / PHASES.length) * 100);

  const goNext = () => {
    const idx = PHASES.indexOf(phase);
    if (idx < PHASES.length - 1) setPhase(PHASES[idx + 1]);
  };
  const goBack = () => {
    const idx = PHASES.indexOf(phase);
    if (idx > 0) setPhase(PHASES[idx - 1]);
  };

  const saveCompanyDetails = async () => {
    if (!companyId) return;
    await supabase
      .from("companies")
      .update({
        address: address || null,
        postal_code: postalCode || null,
        city: city || null,
        phone: phone || null,
        btw_number: btwNumber || null,
        iban: iban || null,
      } as any)
      .eq("id", companyId);
  };

  const finish = async () => {
    setOpen(false);
    if (!user) return;

    // Save provider choices
    if (companyId) {
      await supabase
        .from("companies")
        .update({
          accounting_provider: selectedAccounting,
          email_provider: selectedEmail,
        } as any)
        .eq("id", companyId);
    }

    // Save first customer if provided
    if (customerName.trim() && companyId) {
      const { error } = await supabase.from("customers").insert({
        name: customerName.trim(),
        phone: customerPhone || null,
        email: customerEmail || null,
        address: customerAddress || null,
        city: customerCity || null,
        postal_code: customerPostalCode || null,
        company_id: companyId,
      });
      if (error) {
        toast({ title: "Klant opslaan mislukt", description: error.message, variant: "destructive" });
      }
    }

    await supabase
      .from("profiles")
      .update({ onboarding_completed: true })
      .eq("id", user.id);
  };

  if (onboardingCompleted === null || onboardingCompleted) return null;

  /* ── Renderers ───────────────────────────────────── */

  const renderWelcome = () => (
    <>
      <div className="bg-primary/10 flex items-center justify-center py-12 transition-colors duration-300">
        <div className="h-20 w-20 rounded-2xl bg-card shadow-md flex items-center justify-center">
          <Wind className="h-10 w-10 text-primary" />
        </div>
      </div>
      <div className="px-6 pb-6 pt-4 space-y-4">
        <div className="space-y-2 text-center">
          <h2 className="text-xl font-bold text-foreground">Welkom bij VakFlow! 👋</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Laten we je account instellen zodat je direct aan de slag kunt. 
            We doorlopen een paar stappen om je bedrijfsgegevens in te vullen en de app klaar te maken.
          </p>
        </div>
        <Button className="w-full" onClick={goNext}>
          Laten we beginnen
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </>
  );

  const renderCompanyDetails = () => {
    const isValid = address.trim() && postalCode.trim() && city.trim();
    return (
      <>
        <div className="bg-accent/10 flex items-center justify-center py-8 transition-colors duration-300">
          <div className="h-16 w-16 rounded-2xl bg-card shadow-md flex items-center justify-center">
            <Building2 className="h-8 w-8 text-accent-foreground" />
          </div>
        </div>
        <div className="px-6 pb-6 pt-4 space-y-4">
          <div className="space-y-1 text-center">
            <h2 className="text-lg font-bold text-foreground">Bedrijfsgegevens</h2>
            <p className="text-xs text-muted-foreground">
              Vul je adres en contactgegevens in. Deze komen op je facturen en offertes.
            </p>
          </div>
          <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label htmlFor="ob-address" className="text-xs">Adres *</Label>
              <Input id="ob-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Kerkstraat 12" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="ob-postal" className="text-xs">Postcode *</Label>
                <Input id="ob-postal" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="1234 AB" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ob-city" className="text-xs">Plaats *</Label>
                <Input id="ob-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Amsterdam" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ob-phone" className="text-xs">Telefoonnummer</Label>
              <Input id="ob-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06 12345678" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="ob-btw" className="text-xs">BTW-nummer</Label>
                <Input id="ob-btw" value={btwNumber} onChange={(e) => setBtwNumber(e.target.value)} placeholder="NL123456789B01" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ob-iban" className="text-xs">IBAN</Label>
                <Input id="ob-iban" value={iban} onChange={(e) => setIban(e.target.value)} placeholder="NL91 ABNA 0417 1643 00" />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={goBack}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Terug
            </Button>
            <Button
              className="flex-1"
              disabled={!isValid}
              onClick={async () => {
                await saveCompanyDetails();
                goNext();
              }}
            >
              Volgende
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </>
    );
  };

  const renderFeatures = () => {
    const current = featureSlides[featureSlide];
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
            {featureSlides.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === featureSlide ? "w-6 bg-primary" : "w-1.5 bg-muted"
                }`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => {
              if (featureSlide > 0) setFeatureSlide(featureSlide - 1);
              else goBack();
            }}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Terug
            </Button>
            <Button className="flex-1" onClick={() => {
              if (featureSlide < featureSlides.length - 1) setFeatureSlide(featureSlide + 1);
              else goNext();
            }}>
              {featureSlide < featureSlides.length - 1 ? "Volgende" : "Verder"}
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
            <Button variant="ghost" size="sm" onClick={goBack}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Terug
            </Button>
            <Button variant="ghost" className="text-muted-foreground text-xs" onClick={onNext}>
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

  const renderFirstCustomer = () => (
    <>
      <div className="bg-emerald-500/10 flex items-center justify-center py-8 transition-colors duration-300">
        <div className="h-16 w-16 rounded-2xl bg-card shadow-md flex items-center justify-center">
          <UserPlus className="h-8 w-8 text-emerald-500" />
        </div>
      </div>
      <div className="px-6 pb-6 pt-4 space-y-4">
        <div className="space-y-1 text-center">
          <h2 className="text-lg font-bold text-foreground">Eerste klant toevoegen</h2>
          <p className="text-xs text-muted-foreground">
            Voeg alvast je eerste klant toe. Je kunt dit ook later doen.
          </p>
        </div>
        <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label htmlFor="ob-cust-name" className="text-xs">Naam</Label>
            <Input id="ob-cust-name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Bedrijf of persoon" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="ob-cust-phone" className="text-xs">Telefoon</Label>
              <Input id="ob-cust-phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="06 ..." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ob-cust-email" className="text-xs">E-mail</Label>
              <Input id="ob-cust-email" type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="info@..." />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ob-cust-address" className="text-xs">Adres</Label>
            <Input id="ob-cust-address" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="Straat + huisnr" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="ob-cust-postal" className="text-xs">Postcode</Label>
              <Input id="ob-cust-postal" value={customerPostalCode} onChange={(e) => setCustomerPostalCode(e.target.value)} placeholder="1234 AB" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ob-cust-city" className="text-xs">Plaats</Label>
              <Input id="ob-cust-city" value={customerCity} onChange={(e) => setCustomerCity(e.target.value)} placeholder="Amsterdam" />
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={goBack}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Terug
          </Button>
          <Button variant="ghost" className="text-muted-foreground text-xs" onClick={goNext}>
            Overslaan
          </Button>
          <Button className="flex-1" onClick={goNext} disabled={false}>
            {customerName.trim() ? "Opslaan & verder" : "Overslaan"}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </>
  );

  const renderDone = () => (
    <>
      <div className="bg-primary/10 flex items-center justify-center py-12 transition-colors duration-300">
        <div className="h-20 w-20 rounded-2xl bg-card shadow-md flex items-center justify-center">
          <Sparkles className="h-10 w-10 text-primary" />
        </div>
      </div>
      <div className="px-6 pb-6 pt-4 space-y-4">
        <div className="space-y-2 text-center">
          <h2 className="text-xl font-bold text-foreground">Klaar om te starten! 🎉</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Je account is ingesteld. Je kunt alles altijd wijzigen via <strong>Instellingen</strong>. Veel succes!
          </p>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Check className="h-4 w-4 text-emerald-500" /> Bedrijfsgegevens opgeslagen
          </div>
          {selectedAccounting && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="h-4 w-4 text-emerald-500" /> Boekhoudpakket: {accountingProviders.find(p => p.value === selectedAccounting)?.label}
            </div>
          )}
          {customerName.trim() && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="h-4 w-4 text-emerald-500" /> Eerste klant: {customerName}
            </div>
          )}
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
        {/* Progress bar */}
        <div className="px-6 pt-4">
          <Progress value={progress} className="h-1.5" />
          <p className="text-[10px] text-muted-foreground text-right mt-1">
            Stap {currentIndex + 1} van {PHASES.length}
          </p>
        </div>

        {phase === "welcome" && renderWelcome()}
        {phase === "company" && renderCompanyDetails()}
        {phase === "features" && renderFeatures()}
        {phase === "accounting" &&
          renderProviderChoice(
            "Boekhoudpakket",
            "Welk boekhoudpakket gebruik je? We passen de koppelingen hierop aan.",
            BookOpen,
            "text-accent-foreground",
            "bg-accent/10",
            accountingProviders,
            selectedAccounting,
            setSelectedAccounting,
            goNext,
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
            goNext,
          )}
        {phase === "first-customer" && renderFirstCustomer()}
        {phase === "done" && renderDone()}
      </DialogContent>
    </Dialog>
  );
});

OnboardingDialog.displayName = "OnboardingDialog";

export default OnboardingDialog;
