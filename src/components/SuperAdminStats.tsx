import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Users, FileText, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, subMonths, startOfMonth } from "date-fns";
import { nl } from "date-fns/locale";

interface PlatformStats {
  totalCompanies: number;
  totalUsers: number;
  totalCustomers: number;
  totalWorkOrders: number;
  workOrdersByStatus: { name: string; value: number }[];
  monthlyGrowth: { month: string; companies: number; customers: number; work_orders: number }[];
}

const COLORS = [
  "hsl(237, 84%, 58%)", "hsl(142, 70%, 49%)", "hsl(38, 92%, 50%)",
  "hsl(0, 86%, 60%)", "hsl(263, 83%, 58%)", "hsl(160, 94%, 30%)",
];

const KNOWN_STATUSES = ["open", "in_behandeling", "afgerond", "gefactureerd"];

const SuperAdminStats = () => {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);

      // Server-side counts — no 1000-row limit issue
      const [companiesCount, usersCount, customersCount, workOrdersCount] = await Promise.all([
        supabase.from("companies_safe" as any).select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("customers").select("*", { count: "exact", head: true }),
        supabase.from("work_orders").select("*", { count: "exact", head: true }),
      ]);

      // Work orders by status — individual count queries per status (no row limit)
      const statusCounts = await Promise.all(
        KNOWN_STATUSES.map(async (status) => {
          const { count } = await supabase
            .from("work_orders")
            .select("*", { count: "exact", head: true })
            .eq("status", status);
          return { name: status, value: count ?? 0 };
        })
      );
      const workOrdersByStatus = statusCounts.filter(s => s.value > 0);

      // Monthly growth (last 6 months) — per-month count queries with date filters
      const monthlyGrowth: PlatformStats["monthlyGrowth"] = [];
      const monthRanges = [];
      for (let i = 5; i >= 0; i--) {
        const start = startOfMonth(subMonths(new Date(), i));
        const end = startOfMonth(subMonths(new Date(), i - 1));
        monthRanges.push({ start: start.toISOString(), end: end.toISOString(), label: format(start, "MMM yy", { locale: nl }) });
      }

      // 18 head-count queries in parallel instead of 3 full dataset fetches
      const monthResults = await Promise.all(
        monthRanges.flatMap(({ start, end }) => [
          supabase.from("companies_safe" as any).select("*", { count: "exact", head: true }).gte("created_at", start).lt("created_at", end),
          supabase.from("customers").select("*", { count: "exact", head: true }).gte("created_at", start).lt("created_at", end),
          supabase.from("work_orders").select("*", { count: "exact", head: true }).gte("created_at", start).lt("created_at", end),
        ])
      );

      for (let i = 0; i < monthRanges.length; i++) {
        monthlyGrowth.push({
          month: monthRanges[i].label,
          companies: monthResults[i * 3].count ?? 0,
          customers: monthResults[i * 3 + 1].count ?? 0,
          work_orders: monthResults[i * 3 + 2].count ?? 0,
        });
      }

      setStats({
        totalCompanies: companiesCount.count ?? 0,
        totalUsers: usersCount.count ?? 0,
        totalCustomers: customersCount.count ?? 0,
        totalWorkOrders: workOrdersCount.count ?? 0,
        workOrdersByStatus,
        monthlyGrowth,
      });
      setLoading(false);
    };
    fetchStats();
  }, []);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!stats) return null;

  const kpis = [
    { label: "Bedrijven", value: stats.totalCompanies, icon: Building2, color: "text-primary" },
    { label: "Gebruikers", value: stats.totalUsers, icon: Users, color: "text-primary" },
    { label: "Klanten", value: stats.totalCustomers, icon: Users, color: "text-accent" },
    { label: "Werkbonnen", value: stats.totalWorkOrders, icon: FileText, color: "text-warning" },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(k => (
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

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Work orders by status */}
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Werkbonnen per status</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats.workOrdersByStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {stats.workOrdersByStatus.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Monthly activity */}
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Activiteit afgelopen 6 maanden</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.monthlyGrowth} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="companies" name="Nieuwe bedrijven" stroke="hsl(263, 83%, 58%)" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="customers" name="Nieuwe klanten" stroke="hsl(237, 84%, 58%)" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="work_orders" name="Werkbonnen" stroke="hsl(38, 92%, 50%)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SuperAdminStats;
