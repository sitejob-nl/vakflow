import { useState } from "react";
import { useReportData } from "@/hooks/useReports";
import { useAutomotiveReportData } from "@/hooks/useAutomotiveReports";
import { useCleaningReportData } from "@/hooks/useCleaningReports";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";
import { nl } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import { Loader2, TrendingUp, FileText, Clock, Users, Package, CalendarIcon, Euro, Car, Warehouse, ClipboardCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useIndustryConfig } from "@/hooks/useIndustryConfig";

const STATUS_COLORS: Record<string, string> = {
  open: "hsl(var(--cyan))",
  bezig: "hsl(var(--warning))",
  afgerond: "hsl(var(--success))",
  ingepland: "hsl(var(--primary))",
  onderweg: "hsl(var(--accent))",
  gepland: "hsl(var(--primary))",
  concept: "hsl(var(--muted-foreground))",
  geannuleerd: "hsl(var(--destructive))",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  bezig: "Bezig",
  afgerond: "Afgerond",
  ingepland: "Ingepland",
  onderweg: "Onderweg",
  gepland: "Gepland",
  concept: "Concept",
  geannuleerd: "Geannuleerd",
};

const TYPE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "hsl(var(--accent))",
  "hsl(var(--muted-foreground))",
];

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

  const filters = { startDate, endDate };
  const { data, isLoading } = useReportData(filters);
  const { data: autoData, isAutomotive } = useAutomotiveReportData(filters);
  const { data: cleanData, isCleaning } = useCleaningReportData(filters);
  const { labels } = useIndustryConfig();

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
                <Calendar mode="single" selected={startDate} onSelect={(d) => d && setStartDate(d)} className={cn("p-3 pointer-events-auto")} />
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
                <Calendar mode="single" selected={endDate} onSelect={(d) => d && setEndDate(d)} className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <KpiCard icon={Euro} label="Omzet (gefactureerd)" value={`€${data.totalRevenue.toFixed(0)}`} />
        <KpiCard icon={TrendingUp} label="Omzet (betaald)" value={`€${data.paidRevenue.toFixed(0)}`} accent />
        <KpiCard icon={FileText} label={labels.workOrders} value={String(data.totalWorkOrders)} />
        <KpiCard icon={Clock} label="Gem. doorlooptijd" value={formatDuration(data.avgLeadTimeHours)} />
        <KpiCard icon={Package} label="Materiaalkosten" value={`€${data.totalMaterialCost.toFixed(0)}`} />
        <KpiCard icon={Users} label={`Actieve ${labels.workerPlural.toLowerCase()}`} value={String(data.productivity.length)} />
      </div>

      {isAutomotive ? (
        <Tabs defaultValue="algemeen" className="space-y-5">
          <TabsList>
            <TabsTrigger value="algemeen">Algemeen</TabsTrigger>
            <TabsTrigger value="werkbontype">Per werkbontype</TabsTrigger>
            <TabsTrigger value="werkplaats">Werkplaats</TabsTrigger>
          </TabsList>

          <TabsContent value="algemeen">
            <GeneralCharts
              revenueChartData={revenueChartData}
              pieData={pieData}
              productivity={data.productivity}
              labels={labels}
            />
          </TabsContent>

          <TabsContent value="werkbontype">
            <WorkOrderTypeTab data={autoData} />
          </TabsContent>

          <TabsContent value="werkplaats">
            <WorkshopTab data={autoData} />
          </TabsContent>
        </Tabs>
      ) : (
        <GeneralCharts
          revenueChartData={revenueChartData}
          pieData={pieData}
          productivity={data.productivity}
          labels={labels}
        />
      )}
    </div>
  );
};

/* ─── General Charts (extracted) ─── */
function GeneralCharts({
  revenueChartData,
  pieData,
  productivity,
  labels,
}: {
  revenueChartData: any[];
  pieData: any[];
  productivity: any[];
  labels: any;
}) {
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
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
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 4, fontSize: 12 }}
                />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-[13px] text-t3 text-center py-12 italic">Geen omzetdata in deze periode</p>
          )}
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-[13px] font-bold mb-4">{labels.workOrders} per status</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {pieData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 4, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-[13px] text-t3 text-center py-12 italic">Geen {labels.workOrders.toLowerCase()} in deze periode</p>
          )}
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-5">
        <h3 className="text-[13px] font-bold mb-4">Productiviteit per {labels.worker.toLowerCase()}</h3>
        {productivity.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-[11px] uppercase tracking-wider text-t3 font-bold">{labels.worker}</th>
                  <th className="text-right py-2 text-[11px] uppercase tracking-wider text-t3 font-bold">{labels.workOrders}</th>
                  <th className="text-right py-2 text-[11px] uppercase tracking-wider text-t3 font-bold">Totale tijd</th>
                  <th className="text-right py-2 text-[11px] uppercase tracking-wider text-t3 font-bold">Gem. per {labels.workOrder.toLowerCase()}</th>
                </tr>
              </thead>
              <tbody>
                {productivity
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
            Geen tijdregistraties in deze periode.
          </p>
        )}
      </div>
    </>
  );
}

/* ─── Work Order Type Tab ─── */
function WorkOrderTypeTab({ data }: { data: ReturnType<typeof useAutomotiveReportData>["data"] }) {
  if (!data) return <p className="text-[13px] text-t3 italic py-8 text-center">Laden...</p>;

  const { revenueByType, leadTimeByType } = data;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Revenue by type bar chart */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h3 className="text-[13px] font-bold mb-4">Omzet per werkbontype</h3>
        {revenueByType.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={revenueByType} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `€${v}`} />
              <YAxis type="category" dataKey="type" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={100} />
              <Tooltip
                formatter={(value: number) => [`€${value.toFixed(2)}`, "Omzet"]}
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 4, fontSize: 12 }}
              />
              <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                {revenueByType.map((_, idx) => (
                  <Cell key={idx} fill={TYPE_COLORS[idx % TYPE_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-[13px] text-t3 text-center py-12 italic">Geen afgeronde werkbonnen met type in deze periode</p>
        )}
      </div>

      {/* Lead time by type table */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h3 className="text-[13px] font-bold mb-4">Gem. doorlooptijd per type</h3>
        {leadTimeByType.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-[11px] uppercase tracking-wider text-t3 font-bold">Type</th>
                  <th className="text-right py-2 text-[11px] uppercase tracking-wider text-t3 font-bold">Aantal</th>
                  <th className="text-right py-2 text-[11px] uppercase tracking-wider text-t3 font-bold">Gem. doorlooptijd</th>
                </tr>
              </thead>
              <tbody>
                {leadTimeByType.map((lt) => (
                  <tr key={lt.type} className="border-b border-border last:border-0">
                    <td className="py-2.5 font-semibold">{lt.type}</td>
                    <td className="py-2.5 text-right">{lt.count}</td>
                    <td className="py-2.5 text-right font-semibold text-primary">{formatDuration(lt.avgHours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[13px] text-t3 text-center py-12 italic">Geen afgeronde werkbonnen in deze periode</p>
        )}
      </div>
    </div>
  );
}

/* ─── Workshop Tab ─── */
function WorkshopTab({ data }: { data: ReturnType<typeof useAutomotiveReportData>["data"] }) {
  if (!data) return <p className="text-[13px] text-t3 italic py-8 text-center">Laden...</p>;

  const { bayOccupancy, tireStorageStats } = data;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Bay occupancy line chart */}
      <div className="lg:col-span-2 bg-card border border-border rounded-lg p-5">
        <h3 className="text-[13px] font-bold mb-4">Brugbezetting per week</h3>
        {bayOccupancy.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={bayOccupancy}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
              <Tooltip
                formatter={(value: number) => [value, "Werkbonnen op brug"]}
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 4, fontSize: 12 }}
              />
              <Line type="monotone" dataKey="occupiedCount" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--primary))" }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-[13px] text-t3 text-center py-12 italic">Geen brugdata in deze periode</p>
        )}
      </div>

      {/* Tire storage stats */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h3 className="text-[13px] font-bold mb-4">Bandenopslag</h3>
        <div className="space-y-4 mt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Warehouse className="h-4 w-4 text-primary" />
              <span className="text-[13px]">Opgeslagen</span>
            </div>
            <span className="text-lg font-extrabold text-primary">{tireStorageStats.totalStored}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Car className="h-4 w-4 text-success" />
              <span className="text-[13px]">Gemonteerd</span>
            </div>
            <span className="text-lg font-extrabold text-success">{tireStorageStats.totalMounted}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-[13px]">Afgevoerd</span>
            </div>
            <span className="text-lg font-extrabold text-muted-foreground">{tireStorageStats.totalDisposed}</span>
          </div>
        </div>
        <div className="mt-6 pt-4 border-t border-border">
          <p className="text-[11px] text-t3 uppercase tracking-wider font-bold mb-1">Totaal sets</p>
          <p className="text-2xl font-extrabold">
            {tireStorageStats.totalStored + tireStorageStats.totalMounted + tireStorageStats.totalDisposed}
          </p>
        </div>
      </div>
    </div>
  );
}

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
