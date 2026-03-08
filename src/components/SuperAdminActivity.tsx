import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Activity, AlertTriangle } from "lucide-react";
import { formatDistanceToNow, subDays } from "date-fns";
import { nl } from "date-fns/locale";
import { PlanBadge } from "@/components/SuperAdminSubscriptions";

interface CompanyActivity {
  id: string;
  name: string;
  subscription_status: string;
  subscription_plan: string;
  monthly_price: number;
  last_active_at: string | null;
  wo_7d: number;
  inv_7d: number;
  wa_7d: number;
}

type SortKey = "name" | "last_active_at" | "wo_7d" | "inv_7d" | "wa_7d";

const SuperAdminActivity = () => {
  const [data, setData] = useState<CompanyActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("last_active_at");
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const sevenDaysAgo = subDays(new Date(), 7).toISOString();

      // Fetch companies
      const { data: companies } = await supabase
        .from("companies")
        .select("id, name, subscription_status, subscription_plan, monthly_price, last_active_at")
        .order("last_active_at", { ascending: true, nullsFirst: true }) as { data: any[] | null };

      if (!companies?.length) { setData([]); setLoading(false); return; }

      // Count work orders, invoices, whatsapp messages per company in last 7 days
      const ids = companies.map(c => c.id);

      const [woRes, invRes, waRes] = await Promise.all([
        supabase.from("work_orders").select("company_id", { count: "exact" }).in("company_id", ids).gte("created_at", sevenDaysAgo),
        supabase.from("invoices").select("company_id", { count: "exact" }).in("company_id", ids).gte("created_at", sevenDaysAgo),
        supabase.from("whatsapp_messages" as any).select("company_id", { count: "exact" }).in("company_id", ids).gte("created_at", sevenDaysAgo),
      ]);

      // Build per-company counts from the data arrays
      const woCounts: Record<string, number> = {};
      const invCounts: Record<string, number> = {};
      const waCounts: Record<string, number> = {};

      (woRes.data ?? []).forEach((r: any) => { woCounts[r.company_id] = (woCounts[r.company_id] || 0) + 1; });
      (invRes.data ?? []).forEach((r: any) => { invCounts[r.company_id] = (invCounts[r.company_id] || 0) + 1; });
      (waRes.data ?? []).forEach((r: any) => { waCounts[r.company_id] = (waCounts[r.company_id] || 0) + 1; });

      setData(companies.map(c => ({
        ...c,
        wo_7d: woCounts[c.id] || 0,
        inv_7d: invCounts[c.id] || 0,
        wa_7d: waCounts[c.id] || 0,
      })));
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(key === "name"); }
  };

  const sorted = [...data].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "name") cmp = a.name.localeCompare(b.name);
    else if (sortKey === "last_active_at") {
      const da = a.last_active_at ? new Date(a.last_active_at).getTime() : 0;
      const db = b.last_active_at ? new Date(b.last_active_at).getTime() : 0;
      cmp = da - db;
    } else {
      cmp = (a[sortKey] || 0) - (b[sortKey] || 0);
    }
    return sortAsc ? cmp : -cmp;
  });

  const churnRisk = data.filter(c =>
    c.subscription_status === "active" &&
    c.last_active_at &&
    new Date(c.last_active_at) < subDays(new Date(), 14)
  );

  const isInactive = (c: CompanyActivity) =>
    c.last_active_at && new Date(c.last_active_at) < subDays(new Date(), 14);

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <TableHead className="cursor-pointer select-none hover:text-foreground" onClick={() => handleSort(field)}>
      {label} {sortKey === field ? (sortAsc ? "↑" : "↓") : ""}
    </TableHead>
  );

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {/* Churn alarm */}
      {churnRisk.length > 0 && (
        <Card className="border border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" /> Churn risico — {churnRisk.length} actieve bedrijven &gt;14 dagen inactief
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bedrijf</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">MRR</TableHead>
                  <TableHead>Dagen inactief</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {churnRisk.map(c => {
                  const daysInactive = c.last_active_at
                    ? Math.floor((Date.now() - new Date(c.last_active_at).getTime()) / 86400000)
                    : 0;
                  return (
                    <TableRow key={c.id} className="bg-destructive/5">
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell><PlanBadge plan={c.subscription_plan} /></TableCell>
                      <TableCell className="text-right font-mono">€{(c.monthly_price || 0).toFixed(0)}</TableCell>
                      <TableCell><span className="font-mono text-destructive font-bold">{daysInactive}d</span></TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" disabled>Stuur herinnering</Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Activity heatmap */}
      <Card className="border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> Activiteit per bedrijf (laatste 7 dagen)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader label="Bedrijf" field="name" />
                <SortHeader label="Laatste login" field="last_active_at" />
                <SortHeader label="Werkbonnen (7d)" field="wo_7d" />
                <SortHeader label="Facturen (7d)" field="inv_7d" />
                <SortHeader label="WhatsApp (7d)" field="wa_7d" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map(c => (
                <TableRow key={c.id} className={isInactive(c) ? "bg-muted/50 text-muted-foreground" : ""}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-sm">
                    {c.last_active_at
                      ? formatDistanceToNow(new Date(c.last_active_at), { addSuffix: true, locale: nl })
                      : "Nooit"}
                  </TableCell>
                  <TableCell className="font-mono text-center">{c.wo_7d}</TableCell>
                  <TableCell className="font-mono text-center">{c.inv_7d}</TableCell>
                  <TableCell className="font-mono text-center">{c.wa_7d}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default SuperAdminActivity;
