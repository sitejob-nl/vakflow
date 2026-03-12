import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wind, Loader2, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import KvkSearchInput from "@/components/KvkSearchInput";

const CompanySignupPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [kvkNumber, setKvkNumber] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({ title: "Wachtwoorden komen niet overeen", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("company-signup", {
        body: { email, password, full_name: fullName, company_name: companyName, kvk_number: kvkNumber },
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
        toast({ title: "Welkom bij Vakflow!", description: "Je bedrijf is aangemaakt." });
        navigate("/");
      }
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md shadow-lg border-border">
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
          <CardDescription>
            Maak een account aan voor je bedrijf
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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
              <Label htmlFor="companyName">Bedrijfsnaam *</Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="MV Solutions B.V."
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">Jouw naam *</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jan de Vries"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mailadres *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jan@mvsolutions.nl"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Wachtwoord *</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Bevestig wachtwoord *</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Bedrijf registreren
            </Button>
          </form>
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => navigate("/auth")}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              Al een account? Log hier in
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CompanySignupPage;
