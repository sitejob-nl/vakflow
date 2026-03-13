import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Wind, Loader2, Building2, Wrench, Sparkles, Car, Bug, TreePine, Check, ArrowLeft, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import KvkSearchInput from "@/components/KvkSearchInput";
import { industryConfig, type Industry } from "@/config/industryConfig";
import { cn } from "@/lib/utils";

const STEPS = ["Basis", "Branche", "Inrichting", "Start"] as const;

const industryCards: { id: Industry; icon: typeof Wrench; subtitle: string }[] = [
  { id: "technical", icon: Wrench, subtitle: "Installatie, dakdekken, schilderen, loodgieter" },
  { id: "cleaning", icon: Sparkles, subtitle: "Schoonmaak, glazenwassen, facilitair" },
  { id: "automotive", icon: Car, subtitle: "Garage, bandencentrale, autodealer, schadeherstel" },
  { id: "pest", icon: Bug, subtitle: "Ongediertebestrijding" },
  { id: "landscaping", icon: TreePine, subtitle: "Hoveniers, boomverzorging, groenonderhoud" },
];

const accountingOptions = [
  { value: "exact", label: "Exact Online" },
  { value: "moneybird", label: "Moneybird" },
  { value: "eboekhouden", label: "e-Boekhouden" },
  { value: "snelstart", label: "SnelStart" },
  { value: "rompslomp", label: "Rompslomp" },
  { value: "wefact", label: "WeFact" },
  { value: "", label: "Anders / geen" },
];

const CompanySignupPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(0);

  // Step 1
  const [companyName, setCompanyName] = useState("");
  const [kvkNumber, setKvkNumber] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Step 2
  const [industry, setIndustry] = useState<Industry | "">("");
  const [subcategory, setSubcategory] = useState("");

  // Step 3 - automotive
  const [workshopBays, setWorkshopBays] = useState(2);
  const [autoType, setAutoType] = useState("werkplaats");
  const [useHexon, setUseHexon] = useState(false);

  // Step 3 - cleaning
  const [objectCount, setObjectCount] = useState(10);
  const [doGlazing, setDoGlazing] = useState(false);

  // Step 3 - general
  const [employeeCount, setEmployeeCount] = useState(3);
  const [accountingProvider, setAccountingProvider] = useState("");

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  const effectiveSubcategory = (() => {
    if (industry === "automotive" && (autoType === "verkoop" || autoType === "dealer")) {
      return "dealer";
    }
    return subcategory || "general";
  })();

  const canNext = (): boolean => {
    if (step === 0) return !!(companyName && fullName && email && password && confirmPassword && password === confirmPassword && password.length >= 6);
    if (step === 1) return !!industry;
    if (step === 2) return true;
    return true;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const bayArray = industry === "automotive"
        ? Array.from({ length: workshopBays }, (_, i) => ({ name: `Brug ${i + 1}`, description: "" }))
        : undefined;

      const { data, error } = await supabase.functions.invoke("company-signup", {
        body: {
          email,
          password,
          full_name: fullName,
          company_name: companyName,
          kvk_number: kvkNumber,
          industry: industry || "technical",
          subcategory: effectiveSubcategory,
          accounting_provider: accountingProvider || null,
          workshop_bays: bayArray,
        },
      });

      if (error || data?.error) {
        toast({
          title: "Registratie mislukt",
          description: data?.error || error?.message || "Onbekende fout",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        toast({ title: "Account aangemaakt!", description: "Log in met je nieuwe account." });
        navigate("/auth");
      } else {
        const configName = industry ? industryConfig[industry as Industry]?.name : "Vakflow";
        toast({ title: `Welkom bij ${configName}!`, description: "Je bedrijf is aangemaakt." });
        navigate("/");
      }
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
    setSubmitting(false);
  };

  const subcategories = industry ? Object.entries(industryConfig[industry as Industry].subcategories) : [];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-lg shadow-lg border-border">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <Wind className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-foreground">
              Vak<span className="text-primary">Flow</span>
            </span>
          </div>
          <CardTitle className="text-xl flex items-center justify-center gap-2">
            <Building2 className="h-5 w-5" />
            Bedrijf registreren
          </CardTitle>
          <CardDescription>14 dagen gratis proberen — geen creditcard nodig</CardDescription>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-1 pt-2">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                <div className={cn(
                  "flex items-center justify-center h-7 px-3 rounded-full text-xs font-semibold transition-all",
                  i < step ? "bg-primary text-primary-foreground" :
                  i === step ? "bg-primary text-primary-foreground ring-2 ring-primary/30" :
                  "bg-muted text-muted-foreground"
                )}>
                  {i < step ? <Check className="h-3 w-3" /> : s}
                </div>
                {i < STEPS.length - 1 && <div className={cn("w-6 h-0.5 rounded", i < step ? "bg-primary" : "bg-border")} />}
              </div>
            ))}
          </div>
        </CardHeader>

        <CardContent>
          <div className="min-h-[280px]">
            {/* STEP 0: Basis */}
            {step === 0 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="space-y-2">
                  <Label>KVK-nummer of bedrijfsnaam zoeken</Label>
                  <KvkSearchInput
                    initialValue={kvkNumber}
                    onCompanySelected={(data) => {
                      setKvkNumber(data.kvk_number);
                      if (data.company_name) setCompanyName(data.company_name);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bedrijfsnaam *</Label>
                  <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="MV Solutions B.V." required />
                </div>
                <div className="space-y-2">
                  <Label>Jouw naam *</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jan de Vries" required />
                </div>
                <div className="space-y-2">
                  <Label>E-mailadres *</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jan@mvsolutions.nl" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Wachtwoord *</Label>
                    <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
                  </div>
                  <div className="space-y-2">
                    <Label>Bevestig *</Label>
                    <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
                  </div>
                </div>
                {password && confirmPassword && password !== confirmPassword && (
                  <p className="text-xs text-destructive">Wachtwoorden komen niet overeen</p>
                )}
              </div>
            )}

            {/* STEP 1: Branche */}
            {step === 1 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <Label className="text-sm font-semibold">Kies je branche</Label>
                <div className="grid grid-cols-1 gap-2">
                  {industryCards.map((ic) => {
                    const config = industryConfig[ic.id];
                    const selected = industry === ic.id;
                    return (
                      <button
                        key={ic.id}
                        type="button"
                        onClick={() => { setIndustry(ic.id); setSubcategory(""); }}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border text-left transition-all",
                          selected
                            ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                            : "border-border hover:border-primary/40 hover:bg-muted/50"
                        )}
                      >
                        <div className={cn(
                          "h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0",
                          selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        )}>
                          <ic.icon className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-foreground">{config.name}</div>
                          <div className="text-xs text-muted-foreground">{ic.subtitle}</div>
                        </div>
                        {selected && <Check className="h-4 w-4 text-primary ml-auto" />}
                      </button>
                    );
                  })}
                </div>

                {industry && subcategories.length > 1 && (
                  <div className="space-y-2 pt-2">
                    <Label className="text-sm font-semibold">Specialisatie</Label>
                    <div className="flex flex-wrap gap-2">
                      {subcategories.map(([key, sub]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setSubcategory(key)}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                            (subcategory === key || (!subcategory && key === Object.keys(industryConfig[industry as Industry].subcategories)[0]))
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border text-muted-foreground hover:border-primary/40"
                          )}
                        >
                          {sub.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: Inrichting */}
            {step === 2 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                {industry === "automotive" && (
                  <>
                    <div className="space-y-2">
                      <Label>Hoeveel bruggen/werkplekken heeft u?</Label>
                      <Input type="number" min={0} max={20} value={workshopBays} onChange={(e) => setWorkshopBays(parseInt(e.target.value) || 0)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Wat voor type bedrijf?</Label>
                      <RadioGroup value={autoType} onValueChange={setAutoType}>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="werkplaats" id="at-w" />
                          <Label htmlFor="at-w" className="font-normal">Alleen werkplaats</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="verkoop" id="at-v" />
                          <Label htmlFor="at-v" className="font-normal">Werkplaats + verkoop</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="dealer" id="at-d" />
                          <Label htmlFor="at-d" className="font-normal">Alleen handel / dealer</Label>
                        </div>
                      </RadioGroup>
                    </div>
                    {(autoType === "verkoop" || autoType === "dealer") && (
                      <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                        <div>
                          <Label className="text-sm">Hexon DV portaalpublicatie?</Label>
                          <p className="text-xs text-muted-foreground">Publiceer voertuigen op AutoTrack, Marktplaats, etc.</p>
                        </div>
                        <Switch checked={useHexon} onCheckedChange={setUseHexon} />
                      </div>
                    )}
                  </>
                )}

                {industry === "cleaning" && (
                  <>
                    <div className="space-y-2">
                      <Label>Hoeveel objecten/locaties beheert u?</Label>
                      <Input type="number" min={1} value={objectCount} onChange={(e) => setObjectCount(parseInt(e.target.value) || 1)} />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <Label className="text-sm">Doet u ook glazenwassen?</Label>
                      <Switch checked={doGlazing} onCheckedChange={setDoGlazing} />
                    </div>
                  </>
                )}

                {(industry === "technical" || industry === "landscaping" || industry === "pest") && (
                  <div className="space-y-2">
                    <Label>Hoeveel medewerkers heeft u?</Label>
                    <Input type="number" min={1} value={employeeCount} onChange={(e) => setEmployeeCount(parseInt(e.target.value) || 1)} />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Welk boekhoudpakket gebruikt u?</Label>
                  <Select value={accountingProvider} onValueChange={setAccountingProvider}>
                    <SelectTrigger><SelectValue placeholder="Kies boekhoudpakket" /></SelectTrigger>
                    <SelectContent>
                      {accountingOptions.map((o) => (
                        <SelectItem key={o.value || "none"} value={o.value || "none"}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* STEP 3: Samenvatting */}
            {step === 3 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="rounded-lg border border-border divide-y divide-border">
                  <SummaryRow label="Bedrijf" value={companyName} />
                  <SummaryRow label="Branche" value={industry ? industryConfig[industry as Industry].name : "—"} />
                  <SummaryRow label="Specialisatie" value={
                    industry && effectiveSubcategory
                      ? industryConfig[industry as Industry].subcategories[effectiveSubcategory]?.label ?? effectiveSubcategory
                      : "—"
                  } />
                  {industry === "automotive" && (
                    <>
                      <SummaryRow label="Bruggen" value={String(workshopBays)} />
                      <SummaryRow label="Type" value={autoType === "werkplaats" ? "Alleen werkplaats" : autoType === "verkoop" ? "Werkplaats + verkoop" : "Alleen handel"} />
                      {(autoType === "verkoop" || autoType === "dealer") && (
                        <SummaryRow label="Hexon DV" value={useHexon ? "Ja" : "Nee"} />
                      )}
                    </>
                  )}
                  {industry === "cleaning" && (
                    <>
                      <SummaryRow label="Objecten" value={String(objectCount)} />
                      <SummaryRow label="Glazenwassen" value={doGlazing ? "Ja" : "Nee"} />
                    </>
                  )}
                  {(industry === "technical" || industry === "landscaping" || industry === "pest") && (
                    <SummaryRow label="Medewerkers" value={String(employeeCount)} />
                  )}
                  <SummaryRow label="Boekhouding" value={accountingOptions.find((o) => o.value === accountingProvider || (o.value === "" && accountingProvider === "none"))?.label ?? "Geen"} />
                  <SummaryRow label="Account" value={email} />
                </div>

                <Button
                  className="w-full h-12 text-base font-semibold"
                  disabled={submitting}
                  onClick={handleSubmit}
                >
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Start 14 dagen gratis proefperiode
                </Button>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex justify-between items-center mt-6 pt-4 border-t border-border">
            {step > 0 ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Terug
              </Button>
            ) : (
              <div />
            )}
            {step < 3 && (
              <Button type="button" size="sm" disabled={!canNext()} onClick={() => setStep(step + 1)}>
                Volgende <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>

          {step === 0 && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => navigate("/auth")}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Al een account? Log hier in
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const SummaryRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between items-center px-4 py-2.5">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-sm font-medium text-foreground">{value}</span>
  </div>
);

export default CompanySignupPage;
