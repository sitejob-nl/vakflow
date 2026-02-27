import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Users, FileText, DollarSign, TrendingUp, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from "recharts";
import { format, subMonths, startOfMonth } from "date-fns";
import { nl } from "date-fns/locale";

interface PlatformStats {
  totalCompanies: number;
  totalUsers: number;
  totalCustomers: number;
  totalWorkOrders: number;
  totalInvoices: number;
  totalRevenue: number;
  perCompany: { name: string; customers: number; work_orders: number; invoices: number; revenue: number }[];
  workOrdersByStatus: { name: string; value: number }[];
  monthlyGrowth: { month: string; companies: number; customers: number; work_orders: number }[];
}

const COLORS = [
  "hsl(237, 84%, 58%)", "hsl(142, 70%, 49%)", "hsl(38, 92%, 50%)",
  "hsl(0, 86%, 60%)", "hsl(263, 83%, 58%)", "hsl(160, 94%, 30%)",
];

const SuperAdminStats = () => {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const [companiesRes, profilesRes, customersRes, workOrdersRes, invoicesRes] = await Promise.all([
        supabase.from("companies").select("id, name, created_at"),
        supabase.from("profiles").select("company_id, created_at"),
        supabase.from("customers").select("company_id, created_at"),
        supabase.from("work_orders").select("company_id, status, created_at"),
        supabase.from("invoices").select("company_id, total, status, created_at"),
      ]);

      const companies = companiesRes.data ?? [];
      const profiles = profilesRes.data ?? [];
      const customers = customersRes.data ?? [];
      const workOrders = workOrdersRes.data ?? [];
      const invoices = invoicesRes.data ?? [];

      // Per-company stats
      const perCompany = companies.map(c => ({
        name: c.name.length > 15 ? c.name.slice(0, 15) + "…" : c.name,
        customers: customers.filter(x => x.company_id === c.id).length,
        work_orders: workOrders.filter(x => x.company_id === c.id).length,
        invoices: invoices.filter(x => x.company_id === c.id).length,
        revenue: invoices.filter(x => x.company_id === c.id && x.status === "betaald").reduce((s, i) => s + (Number(i.total) || 0), 0),
      }));

      // Work orders by status
      const statusMap: Record<string, number> = {};
      workOrders.forEach(wo => { statusMap[wo.status] = (statusMap[wo.status] || 0) + 1; });
      const workOrdersByStatus = Object.entries(statusMap).map(([name, value]) => ({ name, value }));

      // Monthly growth (last 6 months)
      const monthlyGrowth: PlatformStats["monthlyGrowth"] = [];
      for (let i = 5; i >= 0; i--) {
        const start = startOfMonth(subMonths(new Date(), i));
        const end = startOfMonth(subMonths(new Date(), i - 1));
        const label = format(start, "MMM yy", { locale: nl });
        monthlyGrowth.push({
          month: label,
          companies: companies.filter(c => new Date(c.created_at) < end).length,
          customers: customers.filter(c => new Date(c.created_at) >= start && new Date(c.created_at) < end).length,
          work_orders: workOrders.filter(w => new Date(w.created_at) >= start && new Date(w.created_at) < end).length,
        });
      }

      const totalRevenue = invoices.filter(i => i.status === "betaald").reduce((s, i) => s + (Number(i.total) || 0), 0);

      setStats({
        totalCompanies: companies.length,
        totalUsers: profiles.length,
        totalCustomers: customers.length,
        totalWorkOrders: workOrders.length,
        totalInvoices: invoices.length,
        totalRevenue,
        perCompany,
        workOrdersByStatus,
        monthlyGrowth,
      });
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!stats) return null;

  const kpis = [
    { label: "Bedrijven", value: stats.totalCompanies, icon: Building2, color: "text-primary" },
    { label: "Gebruikers", value: stats.totalUsers, icon: Users, color: "text-primary" },
    { label: "Klanten", value: stats.totalCustomers, icon: Users, color: "text-accent" },
    { label: "Werkbonnen", value: stats.totalWorkOrders, icon: FileText, color: "text-warning" },
    { label: "Facturen", value: stats.totalInvoices, icon: DollarSign, color: "text-success" },
    { label: "Omzet (betaald)", value: `€${stats.totalRevenue.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}`, icon: TrendingUp, color: "text-success" },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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
        {/* Revenue per company */}
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Omzet per bedrijf</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.perCompany} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `€${v}`} />
                <Tooltip formatter={(v: number) => [`€${v.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}`, "Omzet"]} />
                <Bar dataKey="revenue" fill="hsl(142, 70%, 49%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

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
        <Card className="border lg:col-span-2">
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
                <Line type="monotone" dataKey="customers" name="Nieuwe klanten" stroke="hsl(237, 84%, 58%)" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="work_orders" name="Werkbonnen" stroke="hsl(38, 92%, 50%)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Per-company breakdown table */}
      <Card className="border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Overzicht per bedrijf</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 font-medium">Bedrijf</th>
                  <th className="text-right py-2 font-medium">Klanten</th>
                  <th className="text-right py-2 font-medium">Werkbonnen</th>
                  <th className="text-right py-2 font-medium">Facturen</th>
                  <th className="text-right py-2 font-medium">Omzet</th>
                </tr>
              </thead>
              <tbody>
                {stats.perCompany.map(c => (
                  <tr key={c.name} className="border-b last:border-0">
                    <td className="py-2 font-medium">{c.name}</td>
                    <td className="py-2 text-right">{c.customers}</td>
                    <td className="py-2 text-right">{c.work_orders}</td>
                    <td className="py-2 text-right">{c.invoices}</td>
                    <td className="py-2 text-right font-medium">€{c.revenue.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SuperAdminStats;
