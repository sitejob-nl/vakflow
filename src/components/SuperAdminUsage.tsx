import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { startOfMonth, subMonths, format } from "date-fns";

interface UsageSummary {
  company_id: string;
  event_type: string;
  event_count: number;
}

interface CompanyName {
  id: string;
  name: string;
}

const EVENT_LABELS: Record<string, string> = {
  whatsapp_sent: "WhatsApp verstuurd",
  whatsapp_received: "WhatsApp ontvangen",
  email_sent: "E-mail verstuurd",
  email_automation_sent: "E-mail automatie",
};

const SuperAdminUsage = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<UsageSummary[]>([]);
  const [companies, setCompanies] = useState<CompanyName[]>([]);
  const [period, setPeriod] = useState<"current" | "previous">("current");

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);

      const now = new Date();
      const start = period === "current"
        ? startOfMonth(now)
        : startOfMonth(subMonths(now, 1));
      const end = period === "current"
        ? now
        : startOfMonth(now);

      const [usageRes, companiesRes] = await Promise.all([
        supabase.rpc("get_usage_summary", {
          p_company_id: null,
          p_start: start.toISOString(),
          p_end: end.toISOString(),
        }) as any,
        supabase.from("companies" as any).select("id, name") as any,
      ]);

      setData((usageRes.data as UsageSummary[]) ?? []);
      setCompanies((companiesRes.data as CompanyName[]) ?? []);
      setLoading(false);
    };
    fetch();
  }, [period]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  // Group by company
  const byCompany = new Map<string, Record<string, number>>();
  for (const row of data) {
    if (!byCompany.has(row.company_id)) byCompany.set(row.company_id, {});
    byCompany.get(row.company_id)![row.event_type] = row.event_count;
  }

  const companyMap = new Map(companies.map(c => [c.id, c.name]));
  const eventTypes = [...new Set(data.map(d => d.event_type))].sort();

  const rows = [...byCompany.entries()]
    .map(([cid, events]) => ({
      companyId: cid,
      companyName: companyMap.get(cid) || cid.slice(0, 8),
      events,
      total: Object.values(events).reduce((s, v) => s + v, 0),
    }))
    .sort((a, b) => b.total - a.total);

  const periodLabel = period === "current"
    ? format(startOfMonth(new Date()), "MMMM yyyy")
    : format(startOfMonth(subMonths(new Date(), 1)), "MMMM yyyy");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Usage per bedrijf — {periodLabel}</h3>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as "current" | "previous")}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current">Deze maand</SelectItem>
            <SelectItem value="previous">Vorige maand</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {rows.length === 0 ? (
        <Card className="border">
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            Nog geen usage events geregistreerd in deze periode.
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bedrijf</TableHead>
                {eventTypes.map(et => (
                  <TableHead key={et} className="text-center">{EVENT_LABELS[et] || et}</TableHead>
                ))}
                <TableHead className="text-center font-bold">Totaal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(row => (
                <TableRow key={row.companyId}>
                  <TableCell className="font-medium">{row.companyName}</TableCell>
                  {eventTypes.map(et => (
                    <TableCell key={et} className="text-center">{row.events[et] || 0}</TableCell>
                  ))}
                  <TableCell className="text-center font-bold">{row.total}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default SuperAdminUsage;
