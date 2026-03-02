import { useState } from "react";
import { useReportData } from "@/hooks/useReports";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";
import { nl } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Loader2, TrendingUp, FileText, Clock, Users, Package, CalendarIcon, Euro } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  open: "hsl(var(--cyan))",
  bezig: "hsl(var(--warning))",
  afgerond: "hsl(var(--success))",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  bezig: "Bezig",
  afgerond: "Afgerond",
};

function formatDuration(hours: number) {
  if (hours < 24) return `${Math.round(hours)}u`;
  const days = Math.floor(hours / 24);
  const h = Math.round(hours % 24);
  return `${days}d ${h}u`;
}

function formatMinutes(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}u ${m}m` : `${m}m`;
}

const PRESETS = [
  { label: "Deze maand", getRange: () => ({ start: startOfMonth(new Date()), end: endOfMonth(new Date()) }) },
  { label: "Vorige maand", getRange: () => ({ start: startOfMonth(subMonths(new Date(), 1)), end: endOfMonth(subMonths(new Date(), 1)) }) },
  { label: "Afgelopen 3 maanden", getRange: () => ({ start: startOfMonth(subMonths(new Date(), 2)), end: endOfMonth(new Date()) }) },
  { label: "Afgelopen 6 maanden", getRange: () => ({ start: startOfMonth(subMonths(new Date(), 5)), end: endOfMonth(new Date()) }) },
  { label: "Dit jaar", getRange: () => ({ start: new Date(new Date().getFullYear(), 0, 1), end: endOfMonth(new Date()) }) },
];

const ReportsPage = () => {
  const [startDate, setStartDate] = useState(() => startOfMonth(subMonths(new Date(), 5)));
  const [endDate, setEndDate] = useState(() => endOfMonth(new Date()));

  const { data, isLoading } = useReportData({ startDate, endDate });

  const handlePreset = (preset: typeof PRESETS[number]) => {
    const { start, end } = preset.getRange();
    setStartDate(start);
    setEndDate(end);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  const revenueChartData = data.revenueByMonth.map((r) => ({
    ...r,
    label: format(new Date(r.month + "-01"), "MMM yy", { locale: nl }),
  }));

  const pieData = data.statusCounts.map((s) => ({
    name: STATUS_LABELS[s.status] ?? s.status,
    value: s.count,
    color: STATUS_COLORS[s.status] ?? "hsl(var(--muted-foreground))",
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h1 className="text-xl font-extrabold">Rapportages</h1>
        <div className="flex gap-2 flex-wrap items-center">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => handlePreset(p)}
              className="px-3 py-1.5 text-[11px] font-semibold rounded-sm border border-border bg-card hover:bg-bg-hover transition-colors text-secondary-foreground"
            >
              {p.label}
            </button>
          ))}
          <div className="flex items-center gap-1.5">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="text-[12px] gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {format(startDate, "d MMM yyyy", { locale: nl })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(d) => d && setStartDate(d)}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <span className="text-t3 text-[12px]">–</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="text-[12px] gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {format(endDate, "d MMM yyyy", { locale: nl })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={(d) => d && setEndDate(d)}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <KpiCard icon={Euro} label="Omzet (gefactureerd)" value={`€${data.totalRevenue.toFixed(0)}`} />
        <KpiCard icon={TrendingUp} label="Omzet (betaald)" value={`€${data.paidRevenue.toFixed(0)}`} accent />
        <KpiCard icon={FileText} label="Werkbonnen" value={String(data.totalWorkOrders)} />
        <KpiCard icon={Clock} label="Gem. doorlooptijd" value={formatDuration(data.avgLeadTimeHours)} />
        <KpiCard icon={Package} label="Materiaalkosten" value={`€${data.totalMaterialCost.toFixed(0)}`} />
        <KpiCard icon={Users} label="Actieve monteurs" value={String(data.productivity.length)} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        {/* Revenue chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg p-5">
          <h3 className="text-[13px] font-bold mb-4">Omzet per maand</h3>
          {revenueChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={revenueChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `€${v}`} />
                <Tooltip
                  formatter={(value: number) => [`€${value.toFixed(2)}`, "Omzet"]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 4,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-[13px] text-t3 text-center py-12 italic">Geen omzetdata in deze periode</p>
          )}
        </div>

        {/* Status pie chart */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-[13px] font-bold mb-4">Werkbonnen per status</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {pieData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 4,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-[13px] text-t3 text-center py-12 italic">Geen werkbonnen in deze periode</p>
          )}
        </div>
      </div>

      {/* Productivity table */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h3 className="text-[13px] font-bold mb-4">Productiviteit per monteur</h3>
        {data.productivity.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-[11px] uppercase tracking-wider text-t3 font-bold">Monteur</th>
                  <th className="text-right py-2 text-[11px] uppercase tracking-wider text-t3 font-bold">Werkbonnen</th>
                  <th className="text-right py-2 text-[11px] uppercase tracking-wider text-t3 font-bold">Totale tijd</th>
                  <th className="text-right py-2 text-[11px] uppercase tracking-wider text-t3 font-bold">Gem. per werkbon</th>
                </tr>
              </thead>
              <tbody>
                {data.productivity
                  .sort((a, b) => b.total_minutes - a.total_minutes)
                  .map((p) => (
                    <tr key={p.user_id} className="border-b border-border last:border-0">
                      <td className="py-2.5 font-semibold">{p.full_name}</td>
                      <td className="py-2.5 text-right">{p.work_orders_count}</td>
                      <td className="py-2.5 text-right font-semibold text-primary">{formatMinutes(p.total_minutes)}</td>
                      <td className="py-2.5 text-right text-t3">{formatMinutes(p.avg_minutes_per_wo)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[13px] text-t3 text-center py-8 italic">
            Geen tijdregistraties in deze periode. Start de timer op werkbonnen om productiviteitsdata te verzamelen.
          </p>
        )}
      </div>
    </div>
  );
};

function KpiCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn("h-4 w-4", accent ? "text-primary" : "text-t3")} />
        <span className="text-[11px] text-t3 font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className={cn("text-xl font-extrabold", accent && "text-primary")}>{value}</p>
    </div>
  );
}

export default ReportsPage;
