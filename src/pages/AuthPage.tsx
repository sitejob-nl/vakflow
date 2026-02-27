import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wind, Loader2 } from "lucide-react";
import PWAInstallGuide from "@/components/PWAInstallGuide";
import { useToast } from "@/hooks/use-toast";

const AuthPage = () => {
  const { user, loading, signIn, signUp } = useAuth();
  const { toast } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Password setup flow for invited users
  const [isSettingPassword, setIsSettingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [settingPassword, setSettingPassword] = useState(false);

  useEffect(() => {
    // Check for invite/recovery hash params
    const hash = window.location.hash;
    if (hash && (hash.includes("type=invite") || hash.includes("type=recovery"))) {
      setIsSettingPassword(true);
    }
  }, []);

  // Listen for password recovery event from Supabase
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsSettingPassword(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If user is logged in and NOT setting password, redirect
  if (user && !isSettingPassword) return <Navigate to="/" replace />;

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Wachtwoorden komen niet overeen", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Wachtwoord moet minimaal 6 tekens zijn", variant: "destructive" });
      return;
    }
    setSettingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast({ title: "Fout bij instellen wachtwoord", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Wachtwoord ingesteld!", description: "Je wordt nu doorgestuurd." });
      setIsSettingPassword(false);
      // Clear hash
      window.location.hash = "";
    }
    setSettingPassword(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const { error } = isLogin
      ? await signIn(email, password)
      : await signUp(email, password, fullName);

    if (error) {
      toast({
        title: isLogin ? "Inloggen mislukt" : "Registratie mislukt",
        description: error.message,
        variant: "destructive",
      });
    } else if (!isLogin) {
      toast({
        title: "Account aangemaakt",
        description: "Controleer je e-mail om je account te bevestigen.",
      });
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
              Vent<span className="text-primary">Flow</span>
            </span>
          </div>
          <CardTitle className="text-xl">
            {isSettingPassword ? "Wachtwoord instellen" : isLogin ? "Inloggen" : "Account aanmaken"}
          </CardTitle>
          <CardDescription>
            {isSettingPassword
              ? "Stel een wachtwoord in voor je account"
              : isLogin
              ? "Log in met je Vakflow account"
              : "Maak een nieuw medewerker account aan"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isSettingPassword ? (
            <form onSubmit={handleSetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nieuw wachtwoord</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Bevestig wachtwoord</Label>
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
              <Button type="submit" className="w-full" disabled={settingPassword}>
                {settingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Wachtwoord instellen
              </Button>
            </form>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Volledige naam</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Jan de Vries"
                      required={!isLogin}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">E-mailadres</Label>
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
                  <Label htmlFor="password">Wachtwoord</Label>
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
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isLogin ? "Inloggen" : "Registreren"}
                </Button>
              </form>
              <div className="mt-4 text-center space-y-2">
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors block w-full"
                >
                  {isLogin
                    ? "Medewerker account aanmaken"
                    : "Al een account? Log hier in"}
                </button>
                {isLogin && (
                  <a
                    href="/signup"
                    className="text-sm text-primary hover:underline block"
                  >
                    Bedrijf registreren →
                  </a>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
      <PWAInstallGuide />
    </div>
  );
};

export default AuthPage;
