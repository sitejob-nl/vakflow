import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { formatDistanceToNow, differenceInDays, format } from "date-fns";
import { nl } from "date-fns/locale";

interface CompanyRow {
  id: string;
  name: string;
  industry: string;
  subscription_status: string;
  subscription_plan: string;
  trial_ends_at: string | null;
  monthly_price: number;
  billing_email: string | null;
  stripe_customer_id: string | null;
  admin_notes: string | null;
  last_active_at: string | null;
  created_at: string;
}

const SuperAdminSubscriptions = () => {
  const { toast } = useToast();
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("companies")
      .select("id, name, industry, subscription_status, subscription_plan, trial_ends_at, monthly_price, billing_email, stripe_customer_id, admin_notes, last_active_at, created_at")
      .order("created_at", { ascending: false }) as { data: CompanyRow[] | null };
    setCompanies(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const updateCompany = async (id: string, updates: Record<string, any>, msg: string) => {
    const { error } = await supabase.from("companies").update(updates).eq("id", id);
    if (error) toast({ title: "Fout", description: error.message, variant: "destructive" });
    else { toast({ title: msg }); fetch(); }
  };

  const trials = companies.filter(c => c.subscription_status === "trial").sort((a, b) => {
    if (!a.trial_ends_at) return 1;
    if (!b.trial_ends_at) return -1;
    return new Date(a.trial_ends_at).getTime() - new Date(b.trial_ends_at).getTime();
  });

  const active = companies.filter(c => c.subscription_status === "active");
  const inactive = companies.filter(c => ["cancelled", "suspended", "past_due"].includes(c.subscription_status));
  const totalMRR = active.reduce((s, c) => s + (c.monthly_price || 0), 0);

  const trialDaysLeft = (c: CompanyRow) => {
    if (!c.trial_ends_at) return null;
    return differenceInDays(new Date(c.trial_ends_at), new Date());
  };

  const trialRowClass = (c: CompanyRow) => {
    const days = trialDaysLeft(c);
    if (days === null) return "";
    if (days < 3) return "bg-destructive/5";
    if (days < 7) return "bg-warning/5";
    return "";
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {/* Trials */}
      <Card className="border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-500" /> Trials ({trials.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trials.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Geen actieve trials</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bedrijf</TableHead>
                  <TableHead>Branche</TableHead>
                  <TableHead>Trial verloopt</TableHead>
                  <TableHead className="text-center">Dagen</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trials.map(c => {
                  const days = trialDaysLeft(c);
                  return (
                    <TableRow key={c.id} className={trialRowClass(c)}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{c.industry}</Badge></TableCell>
                      <TableCell className="text-sm">
                        {c.trial_ends_at ? format(new Date(c.trial_ends_at), "d MMM yyyy", { locale: nl }) : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {days !== null && (
                          <span className={`text-sm font-mono font-bold ${days < 3 ? "text-destructive" : days < 7 ? "text-warning" : "text-muted-foreground"}`}>
                            {days}d
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="outline" onClick={() => updateCompany(c.id, { subscription_status: "active" }, `${c.name} geactiveerd`)}>
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Activeren
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => {
                            const newEnd = new Date(c.trial_ends_at || new Date());
                            newEnd.setDate(newEnd.getDate() + 14);
                            updateCompany(c.id, { trial_ends_at: newEnd.toISOString() }, `Trial verlengd voor ${c.name}`);
                          }}>
                            +14d
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Active */}
      <Card className="border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" /> Actief ({active.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Geen actieve subscriptions</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bedrijf</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">MRR</TableHead>
                  <TableHead>Billing e-mail</TableHead>
                  <TableHead>Stripe ID</TableHead>
                  <TableHead>Actief sinds</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {active.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell><PlanBadge plan={c.subscription_plan} /></TableCell>
                    <TableCell className="text-right font-mono">€{(c.monthly_price || 0).toFixed(0)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.billing_email || "—"}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{c.stripe_customer_id || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{format(new Date(c.created_at), "d MMM yyyy", { locale: nl })}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2">
                  <TableCell className="font-bold" colSpan={2}>Totaal MRR</TableCell>
                  <TableCell className="text-right font-mono font-bold">€{totalMRR.toFixed(0)}</TableCell>
                  <TableCell colSpan={3}></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Cancelled / Suspended */}
      {inactive.length > 0 && (
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" /> Geannuleerd / Opgeschort ({inactive.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bedrijf</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notities</TableHead>
                  <TableHead>Laatste activiteit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inactive.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell><StatusBadge status={c.subscription_status} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{c.admin_notes || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.last_active_at ? formatDistanceToNow(new Date(c.last_active_at), { addSuffix: true, locale: nl }) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export const PlanBadge = ({ plan }: { plan: string }) => {
  const styles: Record<string, string> = {
    starter: "bg-muted text-muted-foreground",
    professional: "bg-blue-500/10 text-blue-600",
    enterprise: "bg-purple-500/10 text-purple-600",
  };
  return <Badge variant="outline" className={`text-[10px] border-0 ${styles[plan] || styles.starter}`}>{plan}</Badge>;
};

export const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    trial: "bg-cyan-500/10 text-cyan-600",
    active: "bg-green-500/10 text-green-600",
    past_due: "bg-orange-500/10 text-orange-600",
    cancelled: "bg-destructive/10 text-destructive",
    suspended: "bg-muted text-muted-foreground",
  };
  const labels: Record<string, string> = {
    trial: "Trial", active: "Actief", past_due: "Achterstallig", cancelled: "Geannuleerd", suspended: "Opgeschort",
  };
  return <Badge variant="outline" className={`text-[10px] border-0 ${styles[status] || ""}`}>{labels[status] || status}</Badge>;
};

export default SuperAdminSubscriptions;
