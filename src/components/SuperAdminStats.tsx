import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Users, FileText, Loader2, TrendingUp, AlertTriangle, Clock, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, subMonths, startOfMonth, subDays } from "date-fns";
import { nl } from "date-fns/locale";

interface PlatformStats {
  totalCompanies: number;
  totalUsers: number;
  totalCustomers: number;
  totalWorkOrders: number;
  activeSubscriptions: number;
  trialCount: number;
  trialExpiringSoon: number;
  mrr: number;
  churnRisk: number;
  workOrdersByStatus: { name: string; value: number }[];
  monthlyGrowth: { month: string; companies: number; customers: number; work_orders: number }[];
  planDistribution: { name: string; value: number }[];
  statusDistribution: { name: string; value: number }[];
}

const COLORS = [
  "hsl(237, 84%, 58%)", "hsl(142, 70%, 49%)", "hsl(38, 92%, 50%)",
  "hsl(0, 86%, 60%)", "hsl(263, 83%, 58%)", "hsl(160, 94%, 30%)",
];

const PLAN_COLORS = ["hsl(215, 15%, 60%)", "hsl(217, 91%, 60%)", "hsl(263, 83%, 58%)"];
const STATUS_COLORS = ["hsl(188, 78%, 46%)", "hsl(142, 70%, 49%)", "hsl(38, 92%, 50%)", "hsl(0, 86%, 60%)", "hsl(215, 15%, 60%)"];

const KNOWN_STATUSES = ["open", "in_behandeling", "afgerond", "gefactureerd"];

const SuperAdminStats = () => {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);

      const sevenDaysFromNow = new Date(Date.now() + 7 * 86400000).toISOString();
      const fourteenDaysAgo = subDays(new Date(), 14).toISOString();

      const [companiesCount, usersCount, customersCount, workOrdersCount] = await Promise.all([
        supabase.from("companies_safe" as any).select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("customers").select("*", { count: "exact", head: true }),
        supabase.from("work_orders").select("*", { count: "exact", head: true }),
      ]);

      // Subscription counts
      const [activeRes, trialRes, trialExpiringRes, churnRes] = await Promise.all([
        supabase.from("companies").select("*", { count: "exact", head: true }).eq("subscription_status", "active"),
        supabase.from("companies").select("*", { count: "exact", head: true }).eq("subscription_status", "trial"),
        supabase.from("companies").select("*", { count: "exact", head: true }).eq("subscription_status", "trial").lt("trial_ends_at", sevenDaysFromNow),
        supabase.from("companies").select("*", { count: "exact", head: true }).eq("subscription_status", "active").lt("last_active_at", fourteenDaysAgo),
      ]);

      // MRR
      const { data: activeCompanies } = await supabase
        .from("companies")
        .select("monthly_price, subscription_plan, subscription_status")
        .eq("subscription_status", "active") as { data: any[] | null };
      const mrr = (activeCompanies ?? []).reduce((s: number, c: any) => s + (c.monthly_price || 0), 0);

      // Plan distribution
      const { data: allCompanies } = await supabase
        .from("companies")
        .select("subscription_plan, subscription_status") as { data: any[] | null };

      const planCounts: Record<string, number> = {};
      const statusCounts: Record<string, number> = {};
      (allCompanies ?? []).forEach((c: any) => {
        planCounts[c.subscription_plan || "starter"] = (planCounts[c.subscription_plan || "starter"] || 0) + 1;
        statusCounts[c.subscription_status || "trial"] = (statusCounts[c.subscription_status || "trial"] || 0) + 1;
      });

      const planDistribution = Object.entries(planCounts).map(([name, value]) => ({ name, value }));
      const statusDistribution = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

      // Work orders by status
      const woStatusCounts = await Promise.all(
        KNOWN_STATUSES.map(async (status) => {
          const { count } = await supabase.from("work_orders").select("*", { count: "exact", head: true }).eq("status", status);
          return { name: status, value: count ?? 0 };
        })
      );

      // Monthly growth
      const monthRanges = [];
      for (let i = 5; i >= 0; i--) {
        const start = startOfMonth(subMonths(new Date(), i));
        const end = startOfMonth(subMonths(new Date(), i - 1));
        monthRanges.push({ start: start.toISOString(), end: end.toISOString(), label: format(start, "MMM yy", { locale: nl }) });
      }

      const monthResults = await Promise.all(
        monthRanges.flatMap(({ start, end }) => [
          supabase.from("companies_safe" as any).select("*", { count: "exact", head: true }).gte("created_at", start).lt("created_at", end),
          supabase.from("customers").select("*", { count: "exact", head: true }).gte("created_at", start).lt("created_at", end),
          supabase.from("work_orders").select("*", { count: "exact", head: true }).gte("created_at", start).lt("created_at", end),
        ])
      );

      const monthlyGrowth = monthRanges.map((r, i) => ({
        month: r.label,
        companies: monthResults[i * 3].count ?? 0,
        customers: monthResults[i * 3 + 1].count ?? 0,
        work_orders: monthResults[i * 3 + 2].count ?? 0,
      }));

      setStats({
        totalCompanies: companiesCount.count ?? 0,
        totalUsers: usersCount.count ?? 0,
        totalCustomers: customersCount.count ?? 0,
        totalWorkOrders: workOrdersCount.count ?? 0,
        activeSubscriptions: activeRes.count ?? 0,
        trialCount: trialRes.count ?? 0,
        trialExpiringSoon: trialExpiringRes.count ?? 0,
        mrr,
        churnRisk: churnRes.count ?? 0,
        workOrdersByStatus: woStatusCounts.filter(s => s.value > 0),
        monthlyGrowth,
        planDistribution,
        statusDistribution,
      });
      setLoading(false);
    };
    fetchStats();
  }, []);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!stats) return null;

  const kpis = [
    { label: "Bedrijven", value: stats.totalCompanies, icon: Building2, color: "text-primary" },
    { label: "Actieve subscriptions", value: stats.activeSubscriptions, icon: TrendingUp, color: "text-green-500" },
    { label: "In trial", value: stats.trialCount, icon: Clock, color: "text-cyan-500" },
    { label: "Trial verloopt <7d", value: stats.trialExpiringSoon, icon: AlertTriangle, color: stats.trialExpiringSoon > 0 ? "text-warning" : "text-muted-foreground" },
    { label: "MRR", value: `€${stats.mrr.toFixed(0)}`, icon: DollarSign, color: "text-primary" },
    { label: "Churn risico", value: stats.churnRisk, icon: AlertTriangle, color: stats.churnRisk > 0 ? "text-destructive" : "text-muted-foreground" },
  ];

  const secondaryKpis = [
    { label: "Gebruikers", value: stats.totalUsers, icon: Users, color: "text-primary" },
    { label: "Klanten", value: stats.totalCustomers, icon: Users, color: "text-accent" },
    { label: "Werkbonnen", value: stats.totalWorkOrders, icon: FileText, color: "text-warning" },
  ];

  const statusLabels: Record<string, string> = {
    trial: "Trial", active: "Actief", past_due: "Achterstallig", cancelled: "Geannuleerd", suspended: "Opgeschort",
  };

  return (
    <div className="space-y-6">
      {/* Primary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map(k => (
          <Card key={k.label} className="border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <k.icon className={`w-4 h-4 ${k.color}`} />
                <span className="text-[11px] text-muted-foreground font-medium">{k.label}</span>
              </div>
              <p className="text-xl font-bold">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {secondaryKpis.map(k => (
          <Card key={k.label} className="border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <k.icon className={`w-4 h-4 ${k.color}`} />
                <span className="text-xs text-muted-foreground font-medium">{k.label}</span>
              </div>
              <p className="text-xl font-bold">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Work orders by status */}
        <Card className="border">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Werkbonnen per status</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats.workOrdersByStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {stats.workOrdersByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Monthly activity */}
        <Card className="border">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Activiteit afgelopen 6 maanden</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.monthlyGrowth} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip /><Legend />
                <Line type="monotone" dataKey="companies" name="Nieuwe bedrijven" stroke="hsl(263, 83%, 58%)" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="customers" name="Nieuwe klanten" stroke="hsl(237, 84%, 58%)" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="work_orders" name="Werkbonnen" stroke="hsl(38, 92%, 50%)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Plan distribution */}
        <Card className="border">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Verdeling per plan</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats.planDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {stats.planDistribution.map((_, i) => <Cell key={i} fill={PLAN_COLORS[i % PLAN_COLORS.length]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status distribution */}
        <Card className="border">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Verdeling per status</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats.statusDistribution.map(s => ({ ...s, name: statusLabels[s.name] || s.name }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {stats.statusDistribution.map((_, i) => <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SuperAdminStats;
