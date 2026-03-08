import { useState, useMemo } from "react";
import { useAssets } from "@/hooks/useAssets";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter, differenceInBusinessDays, differenceInWeeks } from "date-fns";

type Period = "this_month" | "last_month" | "quarter";

const getPeriodRange = (period: Period): [Date, Date] => {
  const now = new Date();
  switch (period) {
    case "this_month": return [startOfMonth(now), endOfMonth(now)];
    case "last_month": return [startOfMonth(subMonths(now, 1)), endOfMonth(subMonths(now, 1))];
    case "quarter": return [startOfQuarter(now), endOfQuarter(now)];
  }
};

const getExpectedCount = (frequency: string | null, start: Date, end: Date): number | null => {
  if (!frequency) return null;
  const weeks = Math.max(differenceInWeeks(end, start), 1);
  const businessDays = Math.max(differenceInBusinessDays(end, start), 1);
  switch (frequency) {
    case "daily": return businessDays;
    case "2x_week": return weeks * 2;
    case "3x_week": return weeks * 3;
    case "weekly": return weeks;
    case "biweekly": return Math.max(Math.floor(weeks / 2), 1);
    case "monthly": return Math.max(Math.round(weeks / 4.3), 1);
    case "quarterly": return Math.max(Math.round(weeks / 13), 1);
    case "yearly": return 1;
    default: return null;
  }
};

const complianceColor = (pct: number) => {
  if (pct >= 90) return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
  if (pct >= 70) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
  return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
};

const FrequencyComplianceReport = () => {
  const { companyId } = useAuth();
  const { data: assets } = useAssets();
  const [period, setPeriod] = useState<Period>("this_month");

  const [start, end] = useMemo(() => getPeriodRange(period), [period]);

  // Fetch work order counts per asset in period
  const { data: woCounts } = useQuery({
    queryKey: ["compliance_wo_counts", companyId, period],
    queryFn: async () => {
      const { data } = await supabase
        .from("work_orders" as any)
        .select("asset_id")
        .eq("company_id", companyId!)
        .eq("status", "afgerond")
        .not("asset_id", "is", null)
        .gte("completed_at", start.toISOString())
        .lte("completed_at", end.toISOString());
      // Count per asset
      const counts: Record<string, number> = {};
      (data || []).forEach((wo: any) => {
        counts[wo.asset_id] = (counts[wo.asset_id] || 0) + 1;
      });
      return counts;
    },
    enabled: !!companyId,
  });

  const activeAssets = useMemo(
    () => (assets || []).filter((a) => a.status === "actief" && a.frequency),
    [assets]
  );

  const rows = useMemo(() => {
    return activeAssets.map((asset) => {
      const expected = getExpectedCount(asset.frequency, start, end);
      const actual = woCounts?.[asset.id] || 0;
      const compliance = expected && expected > 0 ? Math.round((actual / expected) * 100) : null;
      return { asset, expected, actual, compliance };
    }).sort((a, b) => (a.compliance ?? 999) - (b.compliance ?? 999));
  }, [activeAssets, woCounts, start, end]);

  const avgCompliance = useMemo(() => {
    const valid = rows.filter((r) => r.compliance !== null);
    if (valid.length === 0) return null;
    return Math.round(valid.reduce((s, r) => s + r.compliance!, 0) / valid.length);
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold">Frequentie-naleving</h3>
          {avgCompliance !== null && (
            <Badge variant="secondary" className={complianceColor(avgCompliance)}>
              Gem. {avgCompliance}%
            </Badge>
          )}
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="this_month">Deze maand</SelectItem>
            <SelectItem value="last_month">Vorige maand</SelectItem>
            <SelectItem value="quarter">Dit kwartaal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Geen objecten met frequentie ingesteld</p>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Object</TableHead>
                <TableHead className="hidden sm:table-cell">Klant</TableHead>
                <TableHead className="text-right">Gepland</TableHead>
                <TableHead className="text-right">Uitgevoerd</TableHead>
                <TableHead className="text-right">Naleving</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.asset.id}>
                  <TableCell className="font-medium">{r.asset.name}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{r.asset.customer?.name || "—"}</TableCell>
                  <TableCell className="text-right font-mono">{r.expected ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono">{r.actual}</TableCell>
                  <TableCell className="text-right">
                    {r.compliance !== null ? (
                      <Badge variant="secondary" className={complianceColor(r.compliance)}>
                        {r.compliance}%
                      </Badge>
                    ) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
};

export default FrequencyComplianceReport;
